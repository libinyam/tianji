// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import TagSelector from "./TagSelector";

// mock 标签库，避免触发 CloudBase 真实查询
vi.mock("@/lib/tags", () => ({
  fetchHotTags: vi.fn(async () => [
    { name: "数学", count: 10, category: "subject" as const },
    { name: "物理", count: 5, category: "subject" as const },
    { name: "CloudBase", count: 8, category: "tool" as const },
  ]),
  searchTags: vi.fn(async () => [
    { name: "数学分析", count: 3, category: "subject" as const },
    { name: "数学建模", count: 2, category: "subject" as const },
  ]),
  PRESET_TAGS: {
    subject: ["数学", "人工智能", "物理", "哲学"],
    tool: ["Codex", "Trae", "CloudBase", "GitHub Actions"],
  },
  CATEGORY_LABEL: { subject: "学科", tool: "工具与部署", casual: "闲聊" },
  isCasualTag: vi.fn((name: string) => ["灌水", "动态", "新闻", "其他", "闲聊"].includes(name)),
}));

import { fetchHotTags, searchTags } from "@/lib/tags";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TagSelector（#191）", () => {
  it("渲染已有标签 + 输入框", async () => {
    const onChange = vi.fn();
    render(<TagSelector value={["已有标签"]} onChange={onChange} />);
    expect(screen.getByText("已有标签")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    // 初次挂载会请求热门标签（排除闲聊区标签）
    await waitFor(() => {
      expect(fetchHotTags).toHaveBeenCalledWith(20, true);
    });
  });

  it("点击 X 移除对应标签", () => {
    const onChange = vi.fn();
    render(<TagSelector value={["A", "B"]} onChange={onChange} />);
    const removeBtns = screen.getAllByRole("button", { name: /^移除标签/ });
    fireEvent.click(removeBtns[0]);
    expect(onChange).toHaveBeenCalledWith(["B"]);
  });

  it("Escape 后 Enter 添加输入值（无 active 项时走 addTag(input) 分支）", () => {
    // 输入会 setActiveIndex(0)，Enter 默认选 flatOptions[0]。
    // 先 Escape 清空 activeIndex，再 Enter 才走 addTag(input)。
    const onChange = vi.fn();
    render(<TagSelector value={[]} onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "新标签" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["新标签"]);
  });

  it("添加后清空输入框", () => {
    const onChange = vi.fn();
    render(<TagSelector value={[]} onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "新标签" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("");
  });

  it("不允许重复添加同一标签", () => {
    // Codex 是 PRESET_TAGS.tool[0]，已选中后 addTag 应跳过
    const onChange = vi.fn();
    render(<TagSelector value={["Codex"]} onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Codex" } });
    // Escape 清空 activeIndex 后 Enter 走 addTag(input)
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("达到 maxTags 时禁用输入", () => {
    const onChange = vi.fn();
    render(<TagSelector value={["A", "B"]} onChange={onChange} maxTags={2} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input).toBeDisabled();
    // 达到上限后不渲染下拉
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Backspace 删除最后一个标签（输入框为空时）", () => {
    const onChange = vi.fn();
    render(<TagSelector value={["A", "B"]} onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(["A"]);
  });

  it("Escape 关闭下拉", () => {
    render(<TagSelector value={[]} onChange={() => {}} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    // 先聚焦打开下拉
    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("点击外部关闭下拉", () => {
    render(
      <div>
        <TagSelector value={[]} onChange={() => {}} />
        <button data-testid="outside">外部按钮</button>
      </div>
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("输入触发搜索（防抖 300ms）", async () => {
    vi.useRealTimers();
    const onChange = vi.fn();
    render(<TagSelector value={[]} onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "数学" } });
    // 防抖窗口内不应触发
    expect(searchTags).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(searchTags).toHaveBeenCalledWith("数学");
    });
  });

  it("键盘 ArrowDown/ArrowUp 导航选项", async () => {
    vi.useRealTimers();
    render(<TagSelector value={[]} onChange={() => {}} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    // 等待热门标签加载
    await waitFor(() => {
      expect(fetchHotTags).toHaveBeenCalled();
    });
    fireEvent.focus(input);
    // 选中第一项
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "tag-option-0");
    // 向下移动到第二项
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "tag-option-1");
    // 向上回到第一项
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", "tag-option-0");
  });

  it("Enter 选中当前 active 项（非输入值）", async () => {
    vi.useRealTimers();
    const onChange = vi.fn();
    render(<TagSelector value={[]} onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    await waitFor(() => {
      expect(fetchHotTags).toHaveBeenCalled();
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    // 应添加 flatOptions[0] 而不是 "x"
    expect(onChange).toHaveBeenCalled();
    const added = onChange.mock.calls[0][0] as string[];
    expect(added[0]).not.toBe("x");
    expect(added[0].length).toBeGreaterThan(0);
  });

  it("点击推荐标签触发 addTag", async () => {
    vi.useRealTimers();
    const onChange = vi.fn();
    render(<TagSelector value={[]} onChange={onChange} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    await waitFor(() => {
      expect(fetchHotTags).toHaveBeenCalled();
    });
    fireEvent.focus(input);
    // 点击任一可选标签
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    fireEvent.click(options[0]);
    expect(onChange).toHaveBeenCalled();
  });

  it("aria-activedescendant 在无 active 项时为 undefined", () => {
    render(<TagSelector value={[]} onChange={() => {}} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("placeholder 在未达上限时显示", () => {
    render(<TagSelector value={["A"]} onChange={() => {}} maxTags={5} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.placeholder).not.toBe("");
  });

  it("placeholder 在达到上限时为空字符串", () => {
    render(<TagSelector value={["A", "B"]} onChange={() => {}} maxTags={2} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.placeholder).toBe("");
  });

  it("输入后清空时同步清除 suggestions", async () => {
    vi.useRealTimers();
    render(<TagSelector value={[]} onChange={() => {}} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "数学" } });
    await waitFor(() => {
      expect(searchTags).toHaveBeenCalledWith("数学");
    });
    // 等待搜索结果渲染
    await waitFor(() => {
      expect(screen.getByText("数学分析")).toBeInTheDocument();
    });
    // 清空输入
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.queryByText("数学分析")).not.toBeInTheDocument();
    });
  });
});
