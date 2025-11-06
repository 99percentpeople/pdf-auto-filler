import {
  cva,
  type VariantProps,
} from "class-variance-authority";

import { cn } from "@/libs/cn";
import { Separator } from "@/components/ui/separator";
import {
  ComponentProps,
  splitProps,
  ValidComponent,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";

const buttonGroupVariants = cva(
  "flex w-fit items-stretch [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md has-[>[data-slot=button-group]]:gap-2",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  },
);

function ButtonGroup(
  props: ComponentProps<"div"> &
    VariantProps<typeof buttonGroupVariants>,
) {
  const [local, rest] = splitProps(props, [
    "class",
    "orientation",
  ]);
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={local.orientation}
      class={cn(
        buttonGroupVariants({
          orientation: local.orientation,
        }),
        local.class,
      )}
      {...rest}
    />
  );
}

type ButtonGroupTextProps = {} & ComponentProps<"div">;

function ButtonGroupText<T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ButtonGroupTextProps>,
) {
  const [local, rest] = splitProps(props, ["class", "as"]);
  return (
    <Dynamic
      component={local.as || "div"}
      class={cn(
        "flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        local.class,
      )}
      {...rest}
    />
  );
}

function ButtonGroupSeparator(
  props: ComponentProps<typeof Separator>,
) {
  const [local, rest] = splitProps(props, [
    "class",
    "orientation",
  ]);
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={local.orientation}
      class={cn(
        "relative m-0! self-stretch bg-input data-[orientation=vertical]:h-auto",
        local.class,
      )}
      {...rest}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};
