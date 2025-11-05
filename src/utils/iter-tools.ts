// utils/iter-tools.ts
export type AnyIterable<T> = Iterable<T> | AsyncIterable<T>;

/**
 * 同步 map：对任意(异步)可迭代逐个同步映射。
 * 产出 AsyncIterable，便于在管道中统一消费。
 */
export function map<T, U>(
  mapper: (value: T, index: number) => U,
) {
  return async function* (
    iterable: AnyIterable<T>,
  ): AsyncIterable<U> {
    let i = 0;
    for await (const v of iterable) {
      yield mapper(v, i++);
    }
  };
}

/**
 * 异步 map：对任意(异步)可迭代逐个 await 映射。
 * 顺序：与输入一致。
 */
export function mapAsync<T, U>(
  mapper: (value: T, index: number) => Promise<U> | U,
) {
  return async function* (
    iterable: AnyIterable<T>,
  ): AsyncIterable<U> {
    let i = 0;
    for await (const v of iterable) {
      yield await mapper(v, i++);
    }
  };
}

/**
 * 并发 map（按输入顺序产出）：
 * - limit：最大并发数（>=1）
 * - mapper：异步/同步函数皆可
 * - 行为：最多并发 limit 个任务；**产出顺序与输入一致**。
 *
 * 如需“完成即产出”（不保证顺序）的版本，可在需要时再给你一个无序实现。
 */
export function mapConcurrent<T, U>(
  limit: number,
  mapper: (value: T, index: number) => Promise<U> | U,
) {
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error(
      "mapConcurrent: limit must be an integer >= 1",
    );
  }

  return async function* (
    iterable: AnyIterable<T>,
  ): AsyncIterable<U> {
    // 任务状态
    const pending = new Map<number, Promise<void>>(); // id -> completion promise
    const results = new Map<number, U>(); // 已完成但未产出的结果
    let inFlight = 0;
    let nextId = 0; // 分配给输入项的自增 id
    let nextToYield = 0; // 下一次应该产出的 id（保证顺序）

    const start = (id: number, value: T) => {
      const p = (async () => {
        const out = await mapper(value, id);
        results.set(id, out);
      })()
        .catch((err) => {
          // 默认：一旦有任务失败，抛出并中止整个生成器
          // 如果你想“错误不致停”，可以改为 results.set(id, sentinel) 并在 yield 处处理
          throw err;
        })
        .finally(() => {
          pending.delete(id);
          inFlight--;
        });

      pending.set(id, p);
      inFlight++;
    };

    const waitOne = () => Promise.race(pending.values());

    // 消费输入并按并发上限启动任务
    for await (const value of iterable) {
      const id = nextId++;
      start(id, value);

      // 并发已满时：等待至少一个完成，并尝试按序产出
      if (inFlight >= limit) {
        await waitOne();
        while (results.has(nextToYield)) {
          const out = results.get(nextToYield)!;
          results.delete(nextToYield++);
          yield out;
        }
      }
    }

    // 输入耗尽：把剩余任务收尾，并按序把所有结果吐完
    while (inFlight > 0) {
      await waitOne();
      while (results.has(nextToYield)) {
        const out = results.get(nextToYield)!;
        results.delete(nextToYield++);
        yield out;
      }
    }
  };
}

/**
 * 简易管道拼接器：按序把可迭代变换器串起来。
 * 使用方式：pipe(stage1, stage2, ...)(input)
 */
export function pipe<TIn, TOut>(
  ...stages: Array<
    (it: AnyIterable<any>) => AsyncIterable<any>
  >
) {
  return (input: AnyIterable<TIn>): AsyncIterable<TOut> =>
    stages.reduce<AnyIterable<any>>(
      (iter, stage) => stage(iter),
      input,
    ) as AsyncIterable<TOut>;
}

export async function consume<T>(
  iterable: AsyncIterable<T>,
) {
  for await (const _ of iterable) {
  }
}

export async function collect<T>(
  iterable: AsyncIterable<T>,
): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iterable) {
    results.push(item);
  }
  return results;
}

// 把 AnyIterable 包装为 AsyncIterable
export function toAsync<T>(
  iterable: AnyIterable<T>,
): AsyncIterable<T> {
  if ((iterable as any)[Symbol.asyncIterator]) {
    return iterable as AsyncIterable<T>;
  }
  return (async function* () {
    for (const v of iterable as Iterable<T>) yield v;
  })();
}

export function compact<T>() {
  return async function* (
    iterable: AnyIterable<T | null | undefined>,
  ): AsyncIterable<T> {
    for await (const v of toAsync(iterable)) {
      if (v != null) yield v as T;
    }
  };
}
