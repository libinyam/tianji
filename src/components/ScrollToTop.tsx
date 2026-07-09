import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** 前进/替换导航时回到页面顶部；后退/前进（POP）不滚动，交给浏览器恢复原位置。 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
    // 仅在路径变化时执行（筛选参数变化不滚顶），navigationType 取当次导航的值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}
