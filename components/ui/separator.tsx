"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function Separator(props: React.HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} className={cn("h-px w-full bg-black/10 border-0", props.className)} />;
}
