import {
  Accessor,
  Component,
  ComponentProps,
  createContext,
  createSignal,
  For,
  onCleanup,
  onMount,
  ParentProps,
  splitProps,
  useContext,
} from "solid-js";

import { cn } from "@/libs/cn";
import "./index.css";
export interface LoggerProps
  extends ComponentProps<"div"> {}

export interface LoggerProviderProps extends ParentProps {
  prefix?: string;
  timestamp?: boolean;
}
export interface LoggerContext {
  items: Accessor<LogItem[]>;
}
export type Level = "log" | "info" | "warn" | "error";
const levels: Level[] = ["log", "info", "warn", "error"];
export interface LogItem {
  message: string;
  level: Level;
}

const originalConsole: { [method: string]: any } = {};

const LoggerContext = createContext<LoggerContext>();
export const LoggerProvider: Component<
  LoggerProviderProps
> = (props) => {
  const [local, rest] = splitProps(props, [
    "children",
    "prefix",
    "timestamp",
  ]);

  const [logItems, setLogItems] = createSignal<LogItem[]>(
    [],
  );

  function hookConsole(): void {
    levels.forEach((method) => {
      originalConsole[method] = console[method];
      console[method] = (...message: any[]) => {
        originalConsole[method](...message); // 保留原始控制台输出
        logToDOM(method, message);
      };
    });
  }
  onMount(() => {
    hookConsole();
  });

  function logToDOM(level: Level, messages: any[]): void {
    let formattedMessage = messages
      .map((msg) =>
        typeof msg === "object"
          ? JSON.stringify(msg, null, 2)
          : msg,
      )
      .join(" ");
    if (local.timestamp) {
      const timestamp = new Date().toLocaleString();
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
  onCleanup(() => {
    distroy();
  });

  return (
    <LoggerContext.Provider
      value={{
        items: logItems,
      }}
    >
      {local.children}
    </LoggerContext.Provider>
  );
};

export const Logger: Component<LoggerProps> = (
  props: LoggerProps,
) => {
  const logger = useContext(LoggerContext);
  const [local, rest] = splitProps(props, ["class"]);
  let [containerRef, setContainerRef] =
    createSignal<HTMLDivElement | null>(null);

  let observer: MutationObserver | undefined;

  onMount(() => {
    const container = containerRef();
    if (container) {
      container.scrollTop = container.scrollHeight;
      observer = new MutationObserver(function (
        mutationsList,
      ) {
        for (let mutation of mutationsList) {
          if (mutation.type === "childList") {
            container.scrollTop = container.scrollHeight;
          }
        }
      });
      observer.observe(container, { childList: true });
    }
  });

  onCleanup(() => {
    observer?.disconnect();
  });

  return (
    <div
      ref={setContainerRef}
      class={cn("logger overflow-y-auto", local.class)}
      {...rest}
    >
      <For each={logger?.items()}>
        {(log) => (
          <div data-level={log.level}>{log.message}</div>
        )}
      </For>
    </div>
  );
};
