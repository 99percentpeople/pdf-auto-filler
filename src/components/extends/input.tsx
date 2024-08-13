import { cn } from "@/libs/cn";
import {
  Component,
  ComponentProps,
  splitProps,
} from "solid-js";

export interface InputProps
  extends ComponentProps<"input"> {}

export const Input: Component<InputProps> = (
  props: InputProps,
) => {
  const [local, rest] = splitProps(props, [
    "class",
    "type",
  ]);
  return (
    <input
      type={local.type}
      class={cn(
        `flex h-9 w-full rounded-md border border-input
        bg-transparent px-3 py-1 text-sm shadow-sm transition-colors
        file:border-0 file:bg-transparent file:text-sm
        file:font-medium placeholder:text-muted-foreground
        focus-visible:outline-none focus-visible:ring-1
        focus-visible:ring-ring disabled:cursor-not-allowed
        disabled:opacity-50`,
        local.class,
      )}
      {...rest}
    />
  );
};
