import { useState } from "react";
import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

export function Sparkline({
  data,
  color,
  height = 40,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const values = data.filter((value) => Number.isFinite(value)).slice(-30);

  let points = "";
  if (values.length > 1 && width > 0) {
    const step = width / (values.length - 1);
    points = values
      .map((value, index) => {
        const clamped = Math.max(0, Math.min(100, value));
        return `${index * step},${height - (clamped / 100) * height}`;
      })
      .join(" ");
  }

  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && points ? (
        <Svg width={width} height={height}>
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
