"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("border border-gold rounded-2xl bg-dark", props.className)} />;
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-4 border-gold", props.className)} />;
}

export function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props} className={cn("text-lg font-semibold", props.className)} />;
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-4", props.className)} />;
}
