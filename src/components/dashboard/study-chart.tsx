"use client";

import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface StudyChartProps {
  data: {
    day: string;
    minutes: number;
  }[];
}

export function StudyChart({ data }: StudyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 200 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        if (width > 0) {
          setDimensions({ width, height: 200 });
        }
      }
    };

    // Initial measurement after mount
    updateDimensions();

    // Also measure after a short delay to handle animation timing
    const timer = setTimeout(updateDimensions, 100);

    // Listen for resize
    window.addEventListener("resize", updateDimensions);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: 200 }}>
      {dimensions.width > 0 && (
        <LineChart width={dimensions.width} height={dimensions.height} data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="day"
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}m`}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#fafafa",
            }}
            formatter={(value) => [`${value} minutes`, "Study Time"]}
          />
          <Line
            type="monotone"
            dataKey="minutes"
            stroke="#2dd4bf"
            strokeWidth={3}
            dot={{ fill: "#2dd4bf", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#2dd4bf" }}
          />
        </LineChart>
      )}
    </div>
  );
}
