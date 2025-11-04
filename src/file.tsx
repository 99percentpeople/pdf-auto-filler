import {
  ComponentProps,
  createEffect,
  createSignal,
  For,
  onMount,
  Ref,
  Show,
} from "solid-js";
import { get, set } from "idb-keyval";
import { Button } from "./components/ui/button";

export type FileManageProps = Omit<
  ComponentProps<"div">,
  "ref"
> & {
  ref?: Ref<{}>;
};

export function FileManage(props: FileManageProps) {
  const [dirHandle, setDirHandle] =
    createSignal<FileSystemDirectoryHandle>();
  onMount(async () => {
    setDirHandle(
      await get<FileSystemDirectoryHandle>("dir"),
    );
    createEffect(async () => {
      await set("dir", dirHandle());
    });
  });
  // const [open, setOpen] = createSignal<boolean>();

  const ref = (el: HTMLDivElement) => {
    // typeof props.ref === "function" &&
    //   props.ref?.({
    //     getFileHandle(name) {},
    //   });
  };
  return (
    <div ref={ref}>
      <Button
        onClick={async () => {
          try {
            const dirHandle =
              await window.showDirectoryPicker({
                startIn: "desktop",
                mode: "readwrite",
              });
            console.log("Selected directory:", dirHandle);
            setDirHandle(dirHandle);
          } catch (err) {
            console.error(err);
          }
        }}
      >
        {dirHandle() ? `Change` : `Open`}
      </Button>
      <Show when={dirHandle()}>
        {(handle) => (
          <FileList
            handle={handle()}
            name={handle().name}
          />
        )}
      </Show>
    </div>
  );
}

export type FileListProps = {
  name: string;
  handle: FileSystemDirectoryHandle;
};

export function FileList(props: FileListProps) {
  const [files, setFiles] =
    createSignal<
      [
        string,
        FileSystemDirectoryHandle | FileSystemFileHandle,
      ][]
    >();

  createEffect(async () => {
    if (props.handle) {
      await props.handle;
      setFiles(
        await Array.fromAsync(props.handle.entries()),
      );
    }
  });
  return (
    <details class="">
      <summary class="">{props.name}</summary>
      <ul>
        <For each={files()}>
          {(file) => (
            <li class="hover:bg-accent hover:text-accent-foreground">
              {file[0]}
            </li>
          )}
        </For>
      </ul>
    </details>
  );
}
