<template>
  <article>
    <h1>C/C++ WASM 评测</h1>
    <p>题目语言选择中，<strong>C (WASM)</strong> 和 <strong>C++17 (WASM)</strong> 是与原生 C、C++ 并列的选项。原语言 ID 保持不变；提交使用独立 ID <code>c-wasm</code> 或 <code>cpp17-wasm</code>。试运行和正式提交会沿用所选 ID。</p>

    <h2>编译环境</h2>
    <p>WASM 选项使用 wasi-sdk 的 Clang/Clang++，目标标准为 C17 与 C++17，C++ 标准库为 libc++，C 标准库为 wasi-libc。它不是 GCC/libstdc++ 环境。GCC 专有头文件（例如 <code>&lt;bits/stdc++.h&gt;</code>）、不可用的系统调用和 WASI sysroot 之外的库不受支持；C++ 异常也未启用。</p>

    <h2>运行限制与结果</h2>
    <p>每次运行在受限容器中执行，并使用独立的 Wasmtime Store、实例和临时文件系统。多个测试点不会共享程序状态或上下文文件。经过可信编译器准备的 AOT 模块可按精确源码、语言和镜像等信息缓存；缓存只复用编译产物，不复用运行状态，也不减少每个测试点的容器启动。</p>
    <ul>
      <li><strong>燃料（fuel）</strong>：Wasmtime 对部分执行操作计量的预算。耗尽会报告燃料超限；fuel 不是 CPU 指令条数，也不等同于毫秒。</li>
      <li><strong>时间</strong>：仍受墙钟运行时限约束。燃料与时间衡量不同，宿主调用也不会按普通 Wasm 指令计燃料。</li>
      <li><strong>内存</strong>：限制 Wasm 线性内存，并受容器运行内存限制；这不是原生进程 RSS，当前不提供等价的 guest 内存采样值。</li>
    </ul>
    <p>特殊评测题仍由独立 checker 判定；checker 不会因提交程序选了 WASM 就变成普通输出比较。系统不会在 WASM 编译或运行失败时自动切回原生评测。</p>

    <h2>如何选择</h2>
    <p>当代码依赖 GCC 扩展、特定系统接口或 C++ 异常时，选择原生语言。WASM 与原生的工具链、限制和内存计量不同；不能据此假定 WASM 总是更快或与原生结果完全相同。</p>
    <p><NuxtLink to="/help">返回帮助目录</NuxtLink></p>
  </article>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'docs' })
useHead({ title: 'C/C++ WASM 评测 — 帮助' })
</script>
