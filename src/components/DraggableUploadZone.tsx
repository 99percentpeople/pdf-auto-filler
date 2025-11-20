import { createSignal, Show } from "solid-js";
import { UploadCloudIcon } from "lucide-solid";

interface DraggableUploadZoneProps {
  /** 文件上传回调 */
  onUpload: (file: File) => void;
  /** input accept 属性，例如 ".pdf" 或 ".xlsx, .xls" */
  accept: string;
  /** 主提示文字 */
  text: string;
  /** 副提示文字（支持格式说明） */
  subText?: string;
  /** 自定义类名 */
  class?: string;
}

export const DraggableUploadZone = (
  props: DraggableUploadZoneProps,
) => {
  const [isDragging, setIsDragging] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files[0];
    if (file) {
      props.onUpload(file);
    }
  };

  const handleFileSelect = (
    e: Event & { currentTarget: HTMLInputElement },
  ) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      props.onUpload(file);
    }
    // 重置 value，允许重复上传同名文件
    e.currentTarget.value = "";
  };

  return (
    <div
      class={`flex h-full w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed transition-colors ${
        isDragging()
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:bg-muted/50"
      } ${props.class ?? ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <label
        class="flex size-20 cursor-pointer items-center justify-center rounded-full bg-background shadow-sm"
      >
        <UploadCloudIcon class="size-10 text-muted-foreground" />
        <input
          ref={inputRef}
          type="file"
          accept={props.accept}
          class="sr-only"
          onChange={handleFileSelect}
        />
      </label>
      <div class="text-center">
        <p class="text-sm font-medium text-foreground">
          {props.text}
        </p>
        <Show when={props.subText}>
          <p class="mt-1 text-xs text-muted-foreground">
            {props.subText}
          </p>
        </Show>
      </div>
    </div>
  );
};
