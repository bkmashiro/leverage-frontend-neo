import { test, expect } from '@playwright/test'

const v4Developers = [
  '曹梦琦', '陈靖宇', '陈曦', '陈轶军', '戴中慧', '杜洋涛', '耿祥',
  '黄珂涵', '李雷', '李雪', '刘晶晶', '倪文卿', '施志强',
  '王申豪', '王旭峰', '杨欣妍', '张斌杰', '张秋雨', '张少华', '朱孟庆',
]
const v5Credits = [
  'Prime Designer：陈靖宇',
  'Judge Core：陈靖宇 王徐旸 胡广 张兴洋',
  'Front-end & Back-end：陈靖宇',
  'FeatureDev：胡广 张兴洋 谢万城',
  'Botzone：张兴洋 施俣喆 庄子昂',
]

for (const width of [390, 1280]) {
  test(`help preserves original explanations and developer credits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/help')
    await expect(page.getByRole('heading', { name: '帮助与系统说明', exact: true })).toBeVisible()
    for (const name of ['关于 OJ', '输入输出', '编译选项', '评测结果说明', '支持语言', '开发人员', '用户协议']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    }
    const main = page.getByRole('main')
    await expect(main).toContainText('另外系统也有完善的比赛与作业系统供日常教学、比赛选拔所用。')
    await expect(main).toContainText('Leverage 判题方式：忽略行末空格和文末回车的全文比较。')
    await expect(main).toContainText('除特别说明外，OJ 题目一律采用多组输入。程序应循环读入直至 EOF。')
    await expect(main).toContainText('时间限制：程序从开始运行到结束的最大允许时间（单位：毫秒 ms）。超出则返回 TLE。')
    await expect(main).toContainText('内存限制：程序运行过程中可使用的最大内存（单位：MB）。超出则返回 MLE。')
    await expect(main).toContainText('gcc -o src src.c -O2 -static -std=gnu11 -lm')
    await expect(main).toContainText('g++ -o src src.cpp -O2 -static -std=gnu++17')
    await expect(main).toContainText('python3 src.py')
    await expect(main).toContainText('node src.js')
    await expect(main).toContainText('TypeScript 经编译后运行（具体版本以评测环境为准）')
    for (const result of ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'SE', 'OLE', 'PE', 'Pending']) {
      await expect(page.getByRole('table', { name: '评测结果说明' }).getByRole('cell', { name: result, exact: true })).toBeVisible()
    }
    await expect(main).toContainText('C、C++11、C++14、C++17、C++20、Python 3、JavaScript、TypeScript')
    const developers = page.getByRole('region', { name: '开发人员', exact: true })
    for (const version of ['V1', 'V2', 'V3', 'V4', 'V5', 'V6 (neo)']) {
      await expect(developers.getByRole('heading', { name: version, exact: true })).toBeVisible()
    }
    await expect(developers.getByText('记录暂缺', { exact: true })).toHaveCount(3)
    for (const name of v4Developers) await expect(developers).toContainText(name)
    for (const credit of v5Credits) await expect(developers).toContainText(credit)
    await expect(developers).toContainText('Full-stack Rewrite：Yuzhe / dylan_233')
    await expect(developers).toContainText('Stack：NestJS + Nuxt 4 + Naive UI + TypeORM + Bull + Redis')
    for (const rule of ['遵守中华人民共和国宪法和法律法规', '不准开车', '不要做没水平的 DDoS / CC / 暴力提交', '禁止抄袭他人代码，违者封号']) {
      await expect(main).toContainText(rule)
    }
    await expect(page.getByRole('link', { name: '下载中心', exact: true })).toHaveAttribute('href', '/download')
    await expect(page.getByRole('region', { name: '用户协议', exact: true }).getByRole('link', { name: '用户协议', exact: true })).toHaveAttribute('href', '/user-agreement')
    await page.getByRole('navigation', { name: '本页内容' }).getByRole('link', { name: '开发人员' }).click()
    await expect(page).toHaveURL(/\/help#developers$/)
    const headingTop = await developers.getByRole('heading', { name: '开发人员', exact: true }).evaluate(el => el.getBoundingClientRect().top)
    expect(headingTop).toBeGreaterThanOrEqual(80)
    expect(headingTop).toBeLessThan(900)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`help-developers-${width}.png`) })
  })
}

test('Botzone help describes the independent local module and links only to local learning material', async ({ page }) => {
  await page.goto('/help/botzone')
  const article = page.getByRole('article')
  await expect(article).toContainText('Botzone 是 Leverage 的独立程序对抗模块')
  await expect(article.locator('a[href^="http://"], a[href^="https://"]')).toHaveCount(0)
  await expect(article).not.toContainText('botzone.org.cn')
  await expect(article.getByRole('link', { name: 'Bot 学习中心', exact: true })).toHaveAttribute('href', '/compete/learn?track=bot&step=1')
  await expect(article.getByRole('link', { name: '返回帮助目录', exact: true })).toHaveAttribute('href', '/help')
})
