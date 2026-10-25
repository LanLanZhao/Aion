# Quest 图标素材

内置 image_gen 工具以用户图 1 为参考生成，未使用 API Key 或 CLI 回退。保留黑白交织折带、中央菱形负空间、纸瓷般的材质和柔和光照。聊天界面的图标继续沿用已有 Lucide 图标。

工程素材：

- `assets/images/quest-icon.png`：完整浅米白底方形图标。
- `assets/images/quest-adaptive-foreground.png`：带安全边距的透明前景。

普通图标的生成提示：

> Create the final production Android launcher icon artwork for the app Quest, based faithfully on the provided reference image. Keep its distinctive four intertwined smooth folded ribbons alternating matte charcoal black and pearl white, forming a balanced rotating four-lobed infinity knot with a small diamond-like negative space in the center. Keep the same sculptural form, diagonal folds, subtle porcelain/paper material, soft studio shading and understated monochrome palette. Output a clean square high-resolution 1024x1024 raster launcher icon asset, not a mockup or screenshot. Use a uniform warm ivory background extending all the way to every canvas edge. Remove the reference's outer rounded app tile border, floating tile, outer drop shadow and white margin: the Android OS will mask the square itself. Center the entire ribbon emblem inside approximately the middle 64 percent of the square so it remains inside Android adaptive icon safe bounds. Keep soft contact shadows immediately beneath the ribbon sculpture only. No lettering, no word Quest, no watermark, no additional symbols, no surrounding border. The goal is to preserve the reference emblem's recognizable appearance as a polished installable app icon.

自适应前景的生成提示：

> Edit target: the provided finished Quest ribbon icon. Produce its Android adaptive-icon FOREGROUND PNG asset on a genuinely transparent background, square canvas. Preserve the exact recognizable sculpture: four intertwined matte charcoal and pearl white folded ribbon lobes, same orientation, shading, topology, proportions and color. Remove only the flat ivory background and distant cast shadow. Reframe the complete emblem smaller, centered so ALL emblem pixels and its subtle edge/contact shading fit inside the central 60 percent of the square canvas, with approximately 20 percent transparent margin on every edge, giving Android adaptive icon mask and parallax safe padding. Keep opaque pearl white ribbons white; never make the white ribbon itself transparent. Do not include a tile, border, text, lettering, checkerboard, new details or extra objects. Output a polished high resolution transparent square PNG foreground asset, no mockup.
