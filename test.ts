function logFunction<T extends (...args: any[]) => any>(
  fn: T,
): T {
  // 使用类型保护来确保类型安全
  return function (
    this: ThisParameterType<T>,
    ...args: Parameters<T>
  ): ReturnType<T> {
    console.log(
      `Calling function ${fn.name} with arguments:`,
      args,
    );
    before(fn.name, args);

    const result: ReturnType<T> = fn.apply(this, args);

    after(fn.name, result);
    console.log(`Function ${fn.name} returned:`, result);
    return result;
  } as T; // 确保返回类型与T相同
}

function before(functionName: string, args: any[]) {
  console.log(`Before executing ${functionName}`);
}

function after(functionName: string, result: any) {
  console.log(`After executing ${functionName}`);
}

// 示例函数，其中包括函数参数
async function operate(
  x: number,
  transform: (n: number) => Promise<number>,
): Promise<number> {
  return await transform(x);
}

// 应用装饰器
const loggedOperate = logFunction(operate);

// 调用装饰后的函数
console.log(loggedOperate(3, async (x) => x * x)); // 输出9
