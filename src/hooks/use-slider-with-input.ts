import { createMemo, createSignal } from "solid-js"

type UseSliderWithInputProps = {
  minValue?: number
  maxValue?: number
  initialValue?: number[]
  defaultValue?: number[]
}

export function createSliderWithInput({
  minValue = 0,
  maxValue = 100,
  initialValue = [minValue],
  defaultValue = [minValue],
}: UseSliderWithInputProps) {
  const [sliderValue, setSliderValue] = createSignal<number[]>(initialValue)
  const [inputValues, setInputValues] = createSignal<string[]>(
    initialValue.map((v) => v.toString())
  )

  const showReset = createMemo(() => {
    const sv = sliderValue()
    return (
      sv.length === defaultValue.length &&
      !sv.every((value, index) => value === defaultValue[index])
    )
  })

  const validateAndUpdateValue = (rawValue: string, index: number) => {
    const sv = sliderValue()
    const iv = inputValues()

    if (rawValue === "" || rawValue === "-") {
      const newInputValues = iv.slice()
      newInputValues[index] = "0"
      setInputValues(newInputValues)

      const newSliderValues = sv.slice()
      newSliderValues[index] = 0
      setSliderValue(newSliderValues)
      return
    }

    const numValue = parseFloat(rawValue)

    if (isNaN(numValue)) {
      const newInputValues = iv.slice()
      newInputValues[index] = sv[index]!.toString()
      setInputValues(newInputValues)
      return
    }

    let clampedValue = Math.min(maxValue, Math.max(minValue, numValue))

    if (sv.length > 1) {
      if (index === 0) {
        clampedValue = Math.min(clampedValue, sv[1]!)
      } else {
        clampedValue = Math.max(clampedValue, sv[0]!)
      }
    }

    const newSliderValues = sv.slice()
    newSliderValues[index] = clampedValue
    setSliderValue(newSliderValues)

    const newInputValues = iv.slice()
    newInputValues[index] = clampedValue.toString()
    setInputValues(newInputValues)
  }

  const handleInputChange = (
    e: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement },
    index: number
  ) => {
    const newValue = e.currentTarget.value
    if (newValue === "" || /^-?\d*\.?\d*$/.test(newValue)) {
      const newInputValues = inputValues().slice()
      newInputValues[index] = newValue
      setInputValues(newInputValues)
    }
  }

  const handleSliderChange = (newValue: number[]) => {
    setSliderValue(newValue)
    setInputValues(newValue.map((v) => v.toString()))
  }

  const resetToDefault = () => {
    setSliderValue(defaultValue)
    setInputValues(defaultValue.map((v) => v.toString()))
  }

  return {
    sliderValue,
    inputValues,
    validateAndUpdateValue,
    handleInputChange,
    handleSliderChange,
    resetToDefault,
    showReset,
  }
}