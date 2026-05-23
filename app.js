const { useState } = React;

function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm your TM6 cooking assistant 👨‍🍳 Ask me for any recipe, then follow up to modify it!" }
  ]);
  const [recipe, setRecipe] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const historyText = updatedMessages
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const currentRecipe = recipe ? `\n\nCurrent recipe on screen: ${JSON.stringify(recipe)}` : "";

    const prompt = `You are an expert Thermomix TM6 cooking assistant.
All weights in grams only. For TM6 steps include settings like [Speed 5 / 100°C / 5 min].${currentRecipe}

--- Conversation ---
${historyText}
--- End ---

Reply as Assistant. Respond ONLY with a JSON object:
{
  "message": "Your friendly chat reply",
  "recipe": {
    "name": "Recipe name",
    "description": "One sentence description",
    "prepTime": "X min",
    "cookTime": "X min",
    "difficulty": "Easy or Medium or Hard",
    "servings": 4,
    "ingredients": ["200g item", "100g item"],
    "steps": ["Step one [Speed 4 / 100°C / 5 min]", "Step two"],
    "tip": "One helpful tip"
  }
}
If not about a recipe, set "recipe" to null.
ONLY output valid JSON. No backticks. No extra text.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": window.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      if (data.error) {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: " + data.error.message }]);
        return;
      }

      const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      setMessages(prev => [...prev, { role: "assistant", content: parsed.message }]);
      if (parsed.recipe) setRecipe(parsed.recipe);

    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again!" }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const diffColor = { "Easy": "#2d7a4f", "Medium": "#b5651d", "Hard": "#c0392b" };

  return React.createElement("div", { style: { fontFamily: "sans-serif", background: "#faf6f0", minHeight: "100vh", display: "flex", flexDirection: "column" } },

    // Header
    React.createElement("div", { style: { background: "#3d2b1f", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 } },
      React.createElement("div", { style: { width: 38, height: 38, borderRadius: "50%", background: "#b5651d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, "👨‍🍳"),
      React.createElement("div", null,
        React.createElement("div", { style: { color: "white", fontWeight: 600, fontSize: 15 } }, "TM6 Recipe Assistant"),
        React.createElement("div", { style: { color: "#c4a882", fontSize: 11 } }, "Your personal Thermomix chef")
      )
    ),

    // Recipe card
    recipe && React.createElement("div", { style: { background: "white", margin: "16px 16px 0", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" } },
      React.createElement("div", { style: { background: "#3d2b1f", padding: "16px 18px" } },
        React.createElement("h2", { style: { color: "white", fontFamily: "Georgia", fontSize: "1.1rem", margin: "0 0 4px" } }, recipe.name),
        React.createElement("p", { style: { color: "#c4a882", fontSize: 12, margin: "0 0 10px" } }, recipe.description),
        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          [{ l: "⏱", v: recipe.prepTime }, { l: "🔥", v: recipe.cookTime }, { l: "👥", v: recipe.servings }].map((b, i) =>
            React.createElement("span", { key: i, style: { background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "white" } }, `${b.l} ${b.v}`)
          ),
          React.createElement("span", { style: { background: diffColor[recipe.difficulty] || "#b5651d", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "white", fontWeight: 600 } }, recipe.difficulty)
        )
      ),
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr" } },
        React.createElement("div", { style: { padding: "12px 14px", borderRight: "1px solid #f0e8d8" } },
          React.createElement("div", { style: { fontSize: 11, color: "#b5651d", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 } }, "Ingredients"),
          recipe.ingredients.map((ing, i) =>
            React.createElement("div", { key: i, style: { fontSize: 12, color: "#4a3728", marginBottom: 4, display: "flex", gap: 6 } },
              React.createElement("span", { style: { color: "#b5651d" } }, "•"),
              React.createElement("span", null, ing)
            )
          )
        ),
        React.createElement("div", { style: { padding: "12px 14px" } },
          React.createElement("div", { style: { fontSize: 11, color: "#b5651d", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 } }, "Method"),
          recipe.steps.map((step, i) =>
            React.createElement("div", { key: i, style: { display: "flex", gap: 8, marginBottom: 6 } },
              React.createElement("div", { style: { width: 17, height: 17, borderRadius: "50%", background: "#b5651d", color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 } }, i + 1),
              React.createElement("p", { style: { fontSize: 12, color: "#4a3728", margin: 0, lineHeight: 1.5 } }, step)
            )
          )
        )
      ),
      recipe.tip && React.createElement("div", { style: { background: "#fff8f0", borderTop: "1px solid #f0e8d8", padding: "10px 14px", fontSize: 12, color: "#7a6353" } },
        React.createElement("strong", { style: { color: "#b5651d" } }, "💡 "), recipe.tip
      )
    ),

    // Chat messages
    React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10 } },
      messages.map((msg, i) =>
        React.createElement("div", { key: i, style: { display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" } },
          React.createElement("div", { style: { maxWidth: "80%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.role === "user" ? "#b5651d" : "white", color: msg.role === "user" ? "white" : "#3d2b1f", fontSize: 13, lineHeight: 1.6, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" } }, msg.content)
        )
      ),
      loading && React.createElement("div", { style: { display: "flex" } },
        React.createElement("div", { style: { background: "white", borderRadius: "16px 16px 16px 4px", padding: "10px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" } }, "Thinking…")
      )
    ),

    // Input
    React.createElement("div", { style: { padding: "10px 14px", background: "white", borderTop: "1px solid #f0e8d8", display: "flex", gap: 8 } },
      React.createElement("input", { value: input, onChange: e => setInput(e.target.value), onKeyDown: handleKey, placeholder: "Ask for a recipe, or say 'make it spicier'…", style: { flex: 1, padding: "9px 13px", borderRadius: 18, border: "1.5px solid #f0e8d8", fontSize: 13, outline: "none", background: "#faf6f0", color: "#3d2b1f" } }),
      React.createElement("button", { onClick: sendMessage, disabled: loading || !input.trim(), style: { width: 38, height: 38, borderRadius: "50%", border: "none", background: loading || !input.trim() ? "#ddd" : "#b5651d", color: "white", fontSize: 16, cursor: loading || !input.trim() ? "not-allowed" : "pointer" } }, "➤")
    )
  );
}

ReactDOM.render(React.createElement(App), document.getElementById("root"));