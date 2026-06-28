/**
 * 天玑bot 自动回复云函数
 * 仅在发帖时触发，调用 DeepSeek API 生成智能回复
 */
const cloud = require("@cloudbase/node-sdk");

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();

const BOT_NAME = "天玑bot";
const BOT_AVATAR_COLOR = "#a78bfa";
const BOT_UID = "ai-bot-001";

exports.main = async (event) => {
  const { postId, postTitle, postBody, tags } = event;

  if (!postTitle || !postBody) {
    return { ok: false, error: "缺少必要参数" };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "未配置 DEEPSEEK_API_KEY" };
  }

  // 构造 system prompt
  const tagStr = tags && tags.length > 0 ? tags.join("、") : "综合";
  const systemPrompt = `你是"天玑bot"，天玑知识社区的AI助手。你擅长${tagStr}领域。用户发了新帖子，请用简洁、友好、专业的语气回应。回复控制在150字以内，可以使用 LaTeX 公式（用 $...$ 包裹行内公式，$$...$$ 包裹块级公式）。不要说"作为AI"，直接给出有价值的回应。`;

  const userMessage = `帖子标题：${postTitle}\n帖子内容：${postBody}\n\n请生成一条简短、有价值的回复。`;

  try {
    // 调用 DeepSeek API
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("DeepSeek API error:", response.status, errText);
      return { ok: false, error: `AI 服务异常 (${response.status})` };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return { ok: false, error: "AI 未返回内容" };
    }

    // 写入数据库 — 作为回答追加到帖子
    if (postId) {
      const docRef = db.collection("posts").doc(postId);
      const { data: postData } = await docRef.get();

      if (postData && postData.length > 0) {
        const post = postData[0];
        const botAnswer = {
          id: `bot_${Date.now()}`,
          author: BOT_NAME,
          authorUid: BOT_UID,
          avatarColor: BOT_AVATAR_COLOR,
          votes: 0,
          accepted: false,
          content: reply,
          date: new Date().toISOString().slice(0, 10),
        };

        const newAnswerList = [...(post.answerList || []), botAnswer];
        await docRef.update({
          answerList: newAnswerList,
          answersCount: newAnswerList.length,
        });

        return { ok: true, reply, answer: botAnswer };
      }
    }

    return { ok: true, reply };
  } catch (err) {
    console.error("AI bot error:", err);
    return { ok: false, error: err.message || "服务器错误" };
  }
};
