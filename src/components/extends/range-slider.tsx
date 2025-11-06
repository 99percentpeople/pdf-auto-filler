import { createSliderWithInput } from "@/hooks/use-slider-with-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Slider,
  SliderFill,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider";
import { createEffect, untrack } from "solid-js";
import { cn } from "@/libs/cn";

export interface DualRangeSliderProps {
  minValue: number;
  maxValue: number;
  initialValue: number[];
  value: number[];
  ariaLabel: string;
  onValueChange: (value: number[]) => void;
  disabled?: boolean;
  class?: string;
}

export default function DualRangeSlider(
  props: DualRangeSliderProps,
) {
  const {
    sliderValue,
    inputValues,
    validateAndUpdateValue,
    handleInputChange,
    handleSliderChange,
  } = createSliderWithInput({
    minValue: props.minValue,
    maxValue: props.maxValue,
    initialValue: props.initialValue,
  });

  createEffect(() => {
    const sliderVal = untrack(sliderValue);
    if (props.initialValue[0] !== sliderVal[0]) {
      handleSliderChange([
        props.initialValue[0],
        sliderVal[1],
      ]);
    }
    if (props.initialValue[1] !== sliderVal[1]) {
      handleSliderChange([
        sliderVal[0],
        props.initialValue[1],
      ]);
    }
  });

  createEffect(() => {
    const sliderVal = untrack(sliderValue);
    if (props.value[0] !== sliderVal[0]) {
      handleSliderChange([props.value[0], sliderVal[1]]);
    }
    if (props.value[1] !== sliderVal[1]) {
      handleSliderChange([sliderVal[0], props.value[1]]);
    }
  });

  createEffect(() => {
    props.onValueChange(sliderValue());
  });

  return (
    <div class={cn("*:not-first:mt-3", props.class)}>
      <Label>{props.ariaLabel}</Label>
      <div class="flex items-center gap-4">
        <Input
          disabled={props.disabled}
          class="h-8 w-12 px-2 py-1"
          type="text"
          inputMode="decimal"
          value={inputValues()[0]}
          onChange={(e) => handleInputChange(e, 0)}
          onBlur={(e) =>
            validateAndUpdateValue(e.currentTarget.value, 0)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              validateAndUpdateValue(
                e.currentTarget.value,
                0,
              );
            }
          }}
          aria-label="Enter minimum value"
        />
        <Slider
          disabled={props.disabled}
          class="grow"
          value={sliderValue()}
          onChange={handleSliderChange}
          minStepsBetweenThumbs={1}
          minValue={props.minValue}
          maxValue={props.maxValue}
          aria-label={props.ariaLabel}
        >
          <SliderTrack>
            <SliderFill />
            <SliderThumb />
            <SliderThumb />
          </SliderTrack>
        </Slider>
        <Input
          disabled={props.disabled}
          class="h-8 w-12 px-2 py-1"
          type="text"
          inputMode="decimal"
          value={inputValues()[1]}
          onChange={(e) => handleInputChange(e, 1)}
          onBlur={(e) =>
            validateAndUpdateValue(e.currentTarget.value, 1)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              validateAndUpdateValue(
                e.currentTarget.value,
                1,
              );
            }
          }}
          aria-label="Enter maximum value"
        />
      </div>
    </div>
  );
}
