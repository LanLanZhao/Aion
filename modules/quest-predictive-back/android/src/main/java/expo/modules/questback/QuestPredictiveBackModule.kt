package expo.modules.questback

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Outline
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.activity.BackEventCompat
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.min

/** Only transient, in-memory page previews. Gesture frames never cross the JS bridge. */
class QuestPredictiveBackModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private val destinations = linkedMapOf<String, Bitmap>()
  private var callback: OnBackPressedCallback? = null
  private var owner: String? = null
  private var destination = ""
  private var overlay: FrameLayout? = null
  private var foreground: ImageView? = null
  private var dim: View? = null
  private var currentBitmap: Bitmap? = null
  private var animator: ValueAnimator? = null
  private var progress = 0f
  private var direction = -1f
  private var startY = 0f
  private var offsetY = 0f
  private var radius = 0f
  private var committing = false
  private var pendingOwner: String? = null

  override fun definition() = ModuleDefinition {
    Name("QuestPredictiveBack")
    Events("onBackCommitted")

    AsyncFunction("captureDestination") { key: String ->
      val root = contentRoot() ?: return@AsyncFunction false
      val bitmap = snapshot(root) ?: return@AsyncFunction false
      // Refresh insertion order: settings and projects share this bounded LRU
      // cache, and capturing the drawer again must keep it as a recent target.
      destinations.remove(key)?.recycle()
      destinations[key] = bitmap
      while (destinations.size > 2) destinations.remove(destinations.keys.first())?.recycle()
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("enable") { nextOwner: String, key: String ->
      register(nextOwner, key)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("disable") { previousOwner: String ->
      if (owner == previousOwner) {
        callback?.remove()
        callback = null
        owner = null
        if (!committing) removeOverlay()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("complete") { completedOwner: String ->
      if (pendingOwner == completedOwner) {
        // Let Router and the custom drawer commit their destination before
        // lifting the native preview. A timeout below also guarantees cleanup.
        main.postDelayed({ if (pendingOwner == completedOwner) removeOverlay() }, 160)
      }
    }.runOnQueue(Queues.MAIN)

    // Opening the system file picker backgrounds this activity. Keep the two
    // bounded destination previews so returning from the picker still previews
    // the correct page; only an in-flight overlay needs cancelling here.
    OnActivityEntersBackground { main.post { removeOverlay() } }
    OnActivityDestroys { main.post { unregister(); clear() } }
    OnDestroy { main.post { unregister(); clear() } }
  }

  private fun contentRoot(): ViewGroup? =
    appContext.currentActivity?.findViewById(android.R.id.content)

  private fun snapshot(root: View): Bitmap? {
    if (root.width <= 0 || root.height <= 0) return null
    // Bound memory on high-resolution phones (at most three 1080-wide images).
    val ratio = min(1f, 1080f / root.width)
    return try {
      Bitmap.createBitmap((root.width * ratio).toInt(), (root.height * ratio).toInt(), Bitmap.Config.ARGB_8888).also {
        val canvas = Canvas(it)
        canvas.scale(ratio, ratio)
        root.draw(canvas)
      }
    } catch (_: OutOfMemoryError) { null }
  }

  private fun register(nextOwner: String, key: String) {
    callback?.remove()
    owner = nextOwner
    destination = key
    val activity = appContext.currentActivity as? ComponentActivity ?: return
    callback = object : OnBackPressedCallback(true) {
      override fun handleOnBackStarted(backEvent: BackEventCompat) {
        if (committing) return
        begin(backEvent)
      }

      override fun handleOnBackProgressed(backEvent: BackEventCompat) {
        if (committing) return
        offsetY = (backEvent.touchY - startY) * .04f
        applyProgress(backEvent.progress)
      }

      override fun handleOnBackCancelled() {
        if (committing) return
        animateProgress(0f, 180) { removeOverlay() }
      }

      override fun handleOnBackPressed() {
        if (committing) return
        committing = true
        pendingOwner = nextOwner
        // Keyboard/system Back on older Android can arrive without progress.
        if (overlay == null) finish(nextOwner)
        else animateProgress(1f, 160) { finish(nextOwner) }
      }
    }.also { activity.onBackPressedDispatcher.addCallback(activity, it) }
  }

  private fun begin(event: BackEventCompat) {
    removeOverlay()
    val root = contentRoot() ?: return
    if (Settings.Global.getFloat(root.context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f) return
    val bitmap = snapshot(root) ?: return
    currentBitmap = bitmap
    direction = if (event.swipeEdge == BackEventCompat.EDGE_RIGHT) -1f else 1f
    startY = event.touchY
    offsetY = 0f
    progress = 0f

    val layer = FrameLayout(root.context).apply {
      setBackgroundColor(Color.rgb(238, 238, 238))
      isClickable = true
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    }
    destinations[destination]?.takeUnless { it.isRecycled }?.let { previous ->
      layer.addView(ImageView(root.context).apply {
        scaleType = ImageView.ScaleType.FIT_XY
        setImageBitmap(previous)
      }, FrameLayout.LayoutParams(-1, -1))
    }
    dim = View(root.context).apply { setBackgroundColor(Color.BLACK); alpha = .24f }
    layer.addView(dim, FrameLayout.LayoutParams(-1, -1))
    foreground = ImageView(root.context).apply {
      scaleType = ImageView.ScaleType.FIT_XY
      setImageBitmap(bitmap)
      clipToOutline = true
      outlineProvider = object : ViewOutlineProvider() {
        override fun getOutline(view: View, outline: Outline) {
          outline.setRoundRect(0, 0, view.width, view.height, radius)
        }
      }
      elevation = 12f * resources.displayMetrics.density
    }
    layer.addView(foreground, FrameLayout.LayoutParams(-1, -1))
    overlay = layer
    root.addView(layer, ViewGroup.LayoutParams(-1, -1))
  }

  private fun applyProgress(value: Float) {
    progress = value.coerceIn(0f, 1f)
    val view = foreground ?: return
    val density = view.resources.displayMetrics.density
    val eased = 1f - (1f - progress) * (1f - progress)
    view.scaleX = 1f - .10f * eased
    view.scaleY = 1f - .10f * eased
    view.translationX = direction * 14f * density * eased
    view.translationY = offsetY * eased
    radius = 28f * density * eased
    view.invalidateOutline()
    dim?.alpha = .24f * (1f - progress * .3f)
  }

  private fun animateProgress(target: Float, duration: Long, done: () -> Unit) {
    animator?.cancel()
    animator = ValueAnimator.ofFloat(progress, target).apply {
      this.duration = duration
      interpolator = DecelerateInterpolator()
      addUpdateListener { applyProgress(it.animatedValue as Float) }
      addListener(object : AnimatorListenerAdapter() {
        private var cancelled = false
        override fun onAnimationCancel(animation: Animator) { cancelled = true }
        override fun onAnimationEnd(animation: Animator) { if (!cancelled) done() }
      })
      start()
    }
  }

  private fun finish(completedOwner: String) {
    // Fade the shrinking foreground while Router returns underneath it.
    foreground?.animate()?.alpha(0f)?.setDuration(130)?.start()
    dim?.animate()?.alpha(0f)?.setDuration(130)?.start()
    sendEvent("onBackCommitted", mapOf("owner" to completedOwner))
    main.postDelayed({ if (pendingOwner == completedOwner) removeOverlay() }, 900)
  }

  private fun removeOverlay() {
    animator?.cancel()
    animator = null
    foreground?.animate()?.cancel()
    foreground?.setImageDrawable(null)
    (overlay?.parent as? ViewGroup)?.removeView(overlay)
    overlay = null
    foreground = null
    dim = null
    currentBitmap?.recycle()
    currentBitmap = null
    progress = 0f
    committing = false
    pendingOwner = null
  }

  private fun clear() {
    removeOverlay()
    destinations.values.forEach { if (!it.isRecycled) it.recycle() }
    destinations.clear()
  }

  private fun unregister() {
    callback?.remove()
    callback = null
    owner = null
  }
}
