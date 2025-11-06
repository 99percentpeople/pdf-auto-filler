import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Slider,
  SliderFill,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider";
import { cn } from "@/libs/cn";
import { createEffect, createSignal } from "solid-js";

export interface DualRangeSliderProps {
  minValue: number;
  maxValue: number;
  initialValue: number[];
  value: number[];
  ariaLabel: string;
  onValueChange: (value: number[]) => void;
  disabled?: boolean;
  minStepsBetweenThumbs?: number;
  class?: string;
}

export default function DualRangeSlider(
  props: DualRangeSliderProps,
) {
  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(val, max));

  const sanitizeRange = (range: number[]): number[] => {
    const min = props.minValue;
    const max = props.maxValue;
    let low = clamp(range[0] ?? min, min, max);
    let high = clamp(range[1] ?? max, min, max);
    if (low > high) [low, high] = [high, low];
    if (props.minStepsBetweenThumbs) {
      const step = props.minStepsBetweenThumbs;
      if (high - low < step) {
        high = Math.min(low + step, props.maxValue);
        if (high === props.maxValue) {
          low = Math.max(high - step, props.minValue);
        }
      }
    }
    return [low, high];
  };

  const [sliderValue, setSliderValue] = createSignal<
    number[]
  >(sanitizeRange(props.value ?? props.initialValue));
  const [inputValues, setInputValues] = createSignal<
    string[]
  >(sliderValue().map(String));

  // Keep in sync when external value changes
  createEffect(() => {
    const next = sanitizeRange(props.value);
    setSliderValue(next);
    setInputValues(next.map(String));
  });

  const handleSliderChange = (next: number[]) => {
    const sanitized = sanitizeRange(next);
    setSliderValue(sanitized);
    setInputValues(sanitized.map(String));
    props.onValueChange?.(sanitized);
  };

  const handleInputChange = (e: Event, index: number) => {
    const target = e.currentTarget as HTMLInputElement;
    const raw = target.value;
    setInputValues((prev) => {
      const copy = [...prev];
      copy[index] = raw;
      return copy;
    });

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    const next = sliderValue().slice();
    next[index] = parsed;
    const sanitized = sanitizeRange(next);
    setSliderValue(sanitized);
    setInputValues(sanitized.map(String));
    props.onValueChange?.(sanitized);
  };

  return (
    <div class={cn("*:not-first:mt-3", props.class)}>
      <Label>{props.ariaLabel}</Label>
      <div class="flex items-center gap-4">
        <Input
          disabled={props.disabled}
          class="h-8 w-12 px-2 py-1 text-center"
          type="text"
          min={props.minValue}
          max={props.maxValue}
          inputMode="decimal"
          value={inputValues()[0]}
          onChange={(e) => handleInputChange(e, 0)}
          aria-label="Enter minimum value"
        />
        <Slider
          disabled={props.disabled}
          class="grow"
          value={sliderValue()}
          onChange={handleSliderChange}
          minStepsBetweenThumbs={
            props.minStepsBetweenThumbs
          }
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
          min={props.minValue}
          max={props.maxValue}
          class="h-8 w-12 px-2 py-1 text-center"
          type="text"
          inputMode="decimal"
          value={inputValues()[1]}
          onChange={(e) => handleInputChange(e, 1)}
          aria-label="Enter maximum value"
        />
      </div>
    </div>
  );
}
