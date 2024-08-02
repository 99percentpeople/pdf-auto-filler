import {
  Component,
  ComponentProps,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";

import { cn } from "@/libs/cn";
import "./index.css";
export interface LoggerProps extends ComponentProps<"div"> {
  prefix?: string;
  timestamp?: boolean;
}
export type Level = "log" | "info" | "warn" | "error";
const levels: Level[] = ["log", "info", "warn", "error"];
export interface LogItem {
  message: string;
  level: Level;
}

const originalConsole: { [method: string]: any } = {};

export const Logger: Component<LoggerProps> = (props: LoggerProps) => {
  const [local, rest] = splitProps(props, ["class", "prefix", "timestamp"]);
  let [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(
    null
  );
  const [logItems, setLogItems] = createSignal<LogItem[]>([]);

  let observer: MutationObserver | undefined;
  function hookConsole(): void {
    levels.forEach((method) => {
      originalConsole[method] = console[method];
      console[method] = (...message: any[]) => {
        originalConsole[method](...message); // 保留原始控制台输出
        logToDOM(method, message);
      };
    });
  }
  function logToDOM(level: Level, messages: any[]): void {
    let formattedMessage = messages
      .map((msg) =>
        typeof msg === "object" ? JSON.stringify(msg, null, 2) : msg
      )
      .join(" ");
    if (local.timestamp) {
      const timestamp = new Date().toISOString();
      formattedMessage = `[${timestamp}] ${formattedMessage}`;
    }
    if (local.prefix) {
      formattedMessage = `${local.prefix} ${formattedMessage}`;
    }
    setLogItems((state) => [
      ...state,
      {
        level: level,
        message: formattedMessage,
      },
    ]);
  }

  function distroy() {
    levels.forEach((method) => {
      console[method] = originalConsole[method];
    });
  }
  onMount(() => {
    const container = containerRef();
    if (container) {
      observer = new MutationObserver(function (mutationsList, observer) {
        for (let mutation of mutationsList) {
          if (mutation.type === "childList") {
            container.scrollTop = container.scrollHeight;
          }
        }
      });
      observer.observe(container, { childList: true });
      hookConsole();
    }
  });
  onCleanup(() => {
    distroy();
    observer?.disconnect();
  });
  return (
    <div
      ref={setContainerRef}
      class={cn("overflow-y-auto", local.class)}
      {...rest}
    >
      <For each={logItems()}>
        {(log) => <div data-level={log.level}>{log.message}</div>}
      </For>
    </div>
  );
};
