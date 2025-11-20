import {
  Accessor,
  Component,
  ComponentProps,
  createContext,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  ParentProps,
  splitProps,
  useContext,
} from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
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
  clear: () => void;
}
export type Level = "log" | "info" | "warn" | "error";
const levels = ["log", "info", "warn", "error"] as const;
export interface LogItem {
  message: string;
  level: Level;
}

const originalConsole: { [method: string]: any } = {};
const LoggerContext = createContext<LoggerContext>();

export const LoggerProvider: Component<
  LoggerProviderProps
> = (props) => {
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

  function distroy() {
    levels.forEach((method) => {
      console[method] = originalConsole[method];
    });
  }

  onMount(() => {
    hookConsole();
  });
  onCleanup(() => {
    distroy();
  });

  function logToDOM(level: Level, messages: any[]): void {
    let formattedMessage = messages
      .map((msg) => {
        if (msg instanceof Error) {
          return msg.stack || msg.message;
        } else if (typeof msg === "object") {
          try {
            return JSON.stringify(msg);
          } catch (e) {
            return String(msg);
          }
        } else {
          return String(msg);
        }
      })
      .join(" ");
    if (props.timestamp) {
      const timestamp = new Date().toLocaleString();
      formattedMessage = `[${timestamp}] ${formattedMessage}`;
    }
    if (props.prefix) {
      formattedMessage = `${props.prefix} ${formattedMessage}`;
    }
    setLogItems((state) => [
      ...state,
      {
        level: level,
        message: formattedMessage,
      },
    ]);
  }

  return (
    <LoggerContext.Provider
      value={{
        items: logItems,
        clear: () => setLogItems([]),
      }}
    >
      {props.children}
    </LoggerContext.Provider>
  );
};

export function useLogger(): LoggerContext {
  const logger = useContext(LoggerContext);
  if (!logger) {
    throw new Error(
      "useLogger must be used within a LoggerProvider",
    );
  }
  return logger;
}

export const Logger: Component<LoggerProps> = (
  props: LoggerProps,
) => {
  const logger = useLogger();
  const [local, rest] = splitProps(props, ["class"]);
  let [containerRef, setContainerRef] =
    createSignal<HTMLDivElement | null>(null);

  let observer: MutationObserver | undefined;

  const count = createMemo(
    () => logger?.items().length || 0,
  );
  const virtualizer = createVirtualizer({
    get count() {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(count() - 1);
      });
      return count();
    },
    getScrollElement: () => containerRef(),
    estimateSize: () => 45,
  });

  const items = virtualizer.getVirtualItems();

  onCleanup(() => {
    observer?.disconnect();
  });

  return (
    <div
      ref={setContainerRef}
      class={cn("logger overflow-y-auto", local.class)}
      {...rest}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${items[0]?.start ?? 0}px)`,
          }}
        >
          <For
            each={items.map(
              (v) => [v, logger.items()[v.index]] as const,
            )}
          >
            {([virtualRow, log]) => (
              <div
                ref={(el) =>
                  queueMicrotask(() =>
                    virtualizer.measureElement(el),
                  )
                }
                data-index={virtualRow.index}
                data-level={log.level}
                class={
                  virtualRow.index % 2 === 0
                    ? "odd"
                    : "even"
                }
              >
                {log.message}
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
