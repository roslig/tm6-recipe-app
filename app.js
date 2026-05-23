const { useState, useRef, useEffect } = React;

const STORAGE_KEY = "Thermomix-cookbook-v1";
const BROWN = "#3d2b1f";
const COPPER = "#b5651d";
const CREAM = "#faf6f0";
const LIGHT = "#f0e8d8";
const GREEN = "#2d7a4f";

const LANGUAGES = [
  { code: "English", label: "🇬🇧 English" },
  { code: "Bahasa Malaysia", label: "🇲🇾 BM" },
  { code: "Mandarin Chinese", label: "🇨🇳 中文" },
  { code: "Tamil", label: "🇮🇳 தமிழ்" },
];

function App() {
  const [tab, setTab] = useState("chat");
  const [language, setLanguage] = useState("English");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm your personal Thermomix chef 👨‍🍳 Ask me for any recipe, upload a fridge photo, or browse your saved cookbook!" }
  ]);
  const [recipe, setRecipe] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { loadRecipes(); }, []);
  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function loadRecipes() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSavedRecipes(JSON.parse(saved));
    } catch (e) { setSavedRecipes([]); }
  }

  function saveToStorage(updated) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (e) {}
  }

  function handleLanguageChange(lang) {
    setLanguage(lang);
    const replies = {
      "English": "Switched to English 🇬🇧 What would you like to cook?",
      "Bahasa Malaysia": "Saya kini akan membalas dalam Bahasa Malaysia 🇲🇾 Apa yang anda ingin masak?",
      "Mandarin Chinese": "我现在将用中文回复您 🇨🇳 您想做什么菜？",
      "Tamil": "நான் இப்போது தமிழில் பதில் சொல்கிறேன் 🇮🇳 என்ன சமைக்க விரும்புகிறீர்கள்?"
    };
    setMessages(prev => [...prev, { role: "assistant", content: replies[lang] || replies["English"] }]);
  }

  async function saveRecipe() {
    if (!recipe) return;
    setSaving(true);
    try {
      const toSave = { ...recipe, id: Date.now(), savedAt: new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) };
      const updated = [toSave, ...savedRecipes];
      setSavedRecipes(updated);
      saveToStorage(updated);
      showToast("Saved to your cookbook! 📖");
    } catch (e) { showToast("Could not save. Try again."); }
    finally { setSaving(false); }
  }

  function deleteRecipe(id) {
    const updated = savedRecipes.filter(r => r.id !== id);
    setSavedRecipes(updated);
    saveToStorage(updated);
    setSelectedRecipe(null);
    showToast("Recipe removed.");
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setImage({ base64: reader.result.split(",")[1], type: file.type });
    reader.readAsDataURL(file);
  }

  async function sendMessage() {
    if ((!input.trim() && !image) || loading) return;

    const userContent = image
      ? "📷 [Photo uploaded] " + (input.trim() || "What can I make with these ingredients?")
      : input.trim();

    const userMessage = { role: "user", content: userContent };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const historyText = updatedMessages
      .map(function(m) { return (m.role === "user" ? "User" : "Assistant") + ": " + m.content; })
      .join("\n\n");

    const currentRecipe = recipe ? "\n\nCurrent recipe on screen: " + JSON.stringify(recipe) : "";

    const prompt = "You are an expert Thermomix cooking assistant with a warm, friendly personality.\n" +
      "IMPORTANT: You must respond ENTIRELY in " + language + ". Every word — the message, recipe name, description, ingredients, steps, and tip — must be in " + language + ".\n" +
      "All weights in grams only. For Thermomix, steps include settings like [Speed 5 / 100°C / 5 min]." + currentRecipe + "\n" +
      (image ? "The user has uploaded a photo of their fridge/ingredients. Identify what you can see and suggest the best recipe.\n" : "") +
      "\n--- Conversation ---\n" + historyText + "\n--- End ---\n\n" +
      "Reply as Assistant. Respond ONLY with a JSON object:\n" +
      '{\n  "message": "Your warm friendly chat reply in ' + language + '",\n' +
      '  "recipe": {\n    "name": "Recipe name in ' + language + '",\n' +
      '    "description": "One sentence description in ' + language + '",\n' +
      '    "prepTime": "X min",\n    "cookTime": "X min",\n' +
      '    "difficulty": "Easy or Medium or Hard",\n    "servings": 4,\n' +
      '    "ingredients": ["200g item in ' + language + '"],\n' +
      '    "steps": ["Step in ' + language + ' [Speed 4 / 100°C / 5 min]"],\n' +
      '    "tip": "Tip in ' + language + '"\n  }\n}\n' +
      "If not about a recipe, set \"recipe\" to null.\n" +
      "ONLY valid JSON. No backticks. No extra text.";

    try {
      var msgContent = image ? [
        { type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } },
        { type: "text", text: prompt }
      ] : [{ type: "text", text: prompt }];

      var response = await fetch("/.netlify/functions/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: msgContent }] })
      });

      var data = await response.json();
      if (data.error) {
        setMessages(function(prev) { return [...prev, { role: "assistant", content: "Error: " + data.error.message }]; });
        return;
      }

      var text = data.content.filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("\n");
      var cleaned = text.replace(/```json|```/g, "").trim();
      var parsed = JSON.parse(cleaned);

      setMessages(function(prev) { return [...prev, { role: "assistant", content: parsed.message }]; });
      if (parsed.recipe) setRecipe(parsed.recipe);
      setImage(null);
      setImageUrl(null);

    } catch (e) {
      setMessages(function(prev) { return [...prev, { role: "assistant", content: "Something went wrong. Please try again!" }]; });
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function printRecipe(r) {
    var win = window.open("", "_blank");
    win.document.write("<html><head><title>" + r.name + "</title><style>body{font-family:Georgia,serif;padding:40px;color:#3d2b1f;max-width:700px;margin:0 auto}h1{color:#b5651d}h2{font-size:13px;text-transform:uppercase;letter-spacing:1px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.badge{display:inline-block;background:#f0e8d8;padding:4px 12px;border-radius:20px;font-size:13px;margin-right:6px}li{margin-bottom:6px;font-size:14px;line-height:1.6}.tip{background:#fff8f0;border-left:4px solid #b5651d;padding:10px 14px;font-style:italic;font-size:13px;margin-top:16px}button{margin-top:20px;padding:10px 20px;background:#b5651d;color:white;border:none;border-radius:8px;cursor:pointer}@media print{button{display:none}}</style></head><body>");
    win.document.write("<h1>" + r.name + "</h1><p>" + r.description + "</p>");
    win.document.write("<p><span class='badge'>⏱ " + r.prepTime + "</span><span class='badge'>🔥 " + r.cookTime + "</span><span class='badge'>👥 " + r.servings + "</span><span class='badge'>" + r.difficulty + "</span></p>");
    win.document.write("<div class='grid'><div><h2>Ingredients</h2><ul>" + r.ingredients.map(function(i) { return "<li>" + i + "</li>"; }).join("") + "</ul></div>");
    win.document.write("<div><h2>Method</h2><ol>" + r.steps.map(function(s) { return "<li>" + s + "</li>"; }).join("") + "</ol></div></div>");
    if (r.tip) win.document.write("<div class='tip'>💡 " + r.tip + "</div>");
    win.document.write("<button onclick='window.print()'>🖨 Print</button></body></html>");
    win.document.close();
  }

  var diffColor = { "Easy": GREEN, "Medium": COPPER, "Hard": "#c0392b" };
  var filteredRecipes = savedRecipes.filter(function(r) { return r.name.toLowerCase().includes(searchQuery.toLowerCase()); });

  function RecipeCard(props) {
    var r = props.r;
    return React.createElement("div", { style: { background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", marginBottom: 12 } },
      React.createElement("div", { style: { background: BROWN, padding: "16px 18px" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("h2", { style: { color: "white", fontFamily: "Georgia", fontSize: "1.1rem", margin: "0 0 4px" } }, r.name),
            React.createElement("p", { style: { color: "#c4a882", fontSize: 12, margin: "0 0 10px" } }, r.description)
          ),
          React.createElement("button", { onClick: function() { printRecipe(r); }, style: { width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "white", fontSize: 14, cursor: "pointer", flexShrink: 0 } }, "🖨")
        ),
        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          React.createElement("span", { style: { background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "white" } }, "⏱ " + r.prepTime),
          React.createElement("span", { style: { background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "white" } }, "🔥 " + r.cookTime),
          React.createElement("span", { style: { background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "white" } }, "👥 " + r.servings),
          React.createElement("span", { style: { background: diffColor[r.difficulty] || COPPER, borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "white", fontWeight: 600 } }, r.difficulty)
        )
      ),
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr" } },
        React.createElement("div", { style: { padding: "12px 14px", borderRight: "1px solid " + LIGHT } },
          React.createElement("div", { style: { fontSize: 11, color: COPPER, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 } }, "Ingredients"),
          r.ingredients.map(function(ing, i) {
            return React.createElement("div", { key: i, style: { fontSize: 12, color: "#4a3728", marginBottom: 4, display: "flex", gap: 6 } },
              React.createElement("span", { style: { color: COPPER } }, "•"),
              React.createElement("span", null, ing)
            );
          })
        ),
        React.createElement("div", { style: { padding: "12px 14px" } },
          React.createElement("div", { style: { fontSize: 11, color: COPPER, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 } }, "Method"),
          r.steps.map(function(step, i) {
            return React.createElement("div", { key: i, style: { display: "flex", gap: 8, marginBottom: 6 } },
              React.createElement("div", { style: { width: 17, height: 17, borderRadius: "50%", background: COPPER, color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 } }, i + 1),
              React.createElement("p", { style: { fontSize: 12, color: "#4a3728", margin: 0, lineHeight: 1.5 } }, step)
            );
          })
        )
      ),
      r.tip && React.createElement("div", { style: { background: "#fff8f0", borderTop: "1px solid " + LIGHT, padding: "10px 14px", fontSize: 12, color: "#7a6353" } },
        React.createElement("strong", { style: { color: COPPER } }, "💡 "), r.tip
      )
    );
  }

  return React.createElement("div", { style: { fontFamily: "sans-serif", background: CREAM, minHeight: "100vh", display: "flex", flexDirection: "column" } },

    // Header
    React.createElement("div", { style: { background: BROWN, padding: "14px 20px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
          React.createElement("div", { style: { width: 38, height: 38, borderRadius: "50%", background: COPPER, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, "👨‍🍳"),
          React.createElement("div", null,
            React.createElement("div", { style: { color: "white", fontWeight: 600, fontSize: 16, fontFamily: "Georgia" } }, "Thermomix Cookbook"),
            React.createElement("div", { style: { color: "#7a6353", fontSize: 11 } }, "Your AI-powered recipe companion")
          )
        ),
        React.createElement("select", { value: language, onChange: function(e) { handleLanguageChange(e.target.value); },
          style: { padding: "6px 10px", borderRadius: 20, border: "none", background: "rgba(255,255,255,0.15)", color: "white", fontSize: 12, cursor: "pointer", outline: "none" } },
          LANGUAGES.map(function(l) {
            return React.createElement("option", { key: l.code, value: l.code, style: { background: BROWN } }, l.label);
          })
        )
      ),
      React.createElement("div", { style: { display: "flex", gap: 6 } },
        React.createElement("button", { onClick: function() { setTab("chat"); setSelectedRecipe(null); },
          style: { padding: "7px 16px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: tab === "chat" ? COPPER : "rgba(255,255,255,0.1)", color: "white" } }, "💬 Chef Chat"),
        React.createElement("button", { onClick: function() { setTab("cookbook"); setSelectedRecipe(null); },
          style: { padding: "7px 16px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: tab === "cookbook" ? COPPER : "rgba(255,255,255,0.1)", color: "white" } }, "📖 Cookbook (" + savedRecipes.length + ")")
      )
    ),

    // CHAT TAB
    tab === "chat" && React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" } },
      recipe && React.createElement("div", { style: { padding: "12px 14px 0", overflowY: "auto", maxHeight: "50vh" } },
        React.createElement(RecipeCard, { r: recipe }),
        React.createElement("button", { onClick: saveRecipe, disabled: saving,
          style: { width: "100%", padding: "11px", background: saving ? "#ccc" : GREEN, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", marginBottom: 4 } },
          saving ? "Saving…" : "💾 Save to Cookbook")
      ),
      imageUrl && React.createElement("div", { style: { padding: "8px 14px 0", display: "flex", alignItems: "center", gap: 10 } },
        React.createElement("img", { src: imageUrl, style: { width: 56, height: 56, objectFit: "cover", borderRadius: 10 }, alt: "upload" }),
        React.createElement("div", { style: { fontSize: 13, color: "#7a6353" } }, "Photo ready to send"),
        React.createElement("button", { onClick: function() { setImage(null); setImageUrl(null); },
          style: { padding: "4px 10px", background: "white", border: "1px solid " + LIGHT, borderRadius: 8, fontSize: 12, color: "#7a6353", cursor: "pointer" } }, "✕")
      ),
      React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 } },
        messages.map(function(msg, i) {
          return React.createElement("div", { key: i, style: { display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" } },
            React.createElement("div", { style: { maxWidth: "80%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.role === "user" ? COPPER : "white", color: msg.role === "user" ? "white" : BROWN, fontSize: 13, lineHeight: 1.6, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" } }, msg.content)
          );
        }),
        loading && React.createElement("div", { style: { display: "flex" } },
          React.createElement("div", { style: { background: "white", borderRadius: "16px 16px 16px 4px", padding: "10px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", display: "flex", gap: 4 } },
            [0,1,2].map(function(i) { return React.createElement("div", { key: i, style: { width: 7, height: 7, borderRadius: "50%", background: COPPER, animation: "bounce 1s infinite", animationDelay: (i*0.2) + "s" } }); })
          )
        ),
        React.createElement("div", { ref: bottomRef })
      ),
      React.createElement("div", { style: { padding: "10px 14px", background: "white", borderTop: "1px solid " + LIGHT, display: "flex", gap: 8, alignItems: "center" } },
        React.createElement("button", { onClick: function() { fileRef.current.click(); },
          style: { width: 36, height: 36, borderRadius: "50%", border: "1.5px solid " + LIGHT, background: CREAM, fontSize: 16, cursor: "pointer", flexShrink: 0 } }, "📷"),
        React.createElement("input", { ref: fileRef, type: "file", accept: "image/*", onChange: handleImageUpload, style: { display: "none" } }),
        React.createElement("textarea", { value: input, onChange: function(e) { setInput(e.target.value); }, onKeyDown: handleKey,
          placeholder: "Ask for a recipe, say 'make it spicier', or upload a 📷…", rows: 1,
          style: { flex: 1, padding: "9px 13px", borderRadius: 18, border: "1.5px solid " + LIGHT, fontSize: 13, fontFamily: "sans-serif", resize: "none", outline: "none", background: CREAM, color: BROWN } }),
        React.createElement("button", { onClick: sendMessage, disabled: loading || (!input.trim() && !image),
          style: { width: 36, height: 36, borderRadius: "50%", border: "none", background: (loading || (!input.trim() && !image)) ? "#ddd" : COPPER, color: "white", fontSize: 16, cursor: (loading || (!input.trim() && !image)) ? "not-allowed" : "pointer", flexShrink: 0 } }, "➤")
      )
    ),

    // COOKBOOK TAB
    tab === "cookbook" && React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "16px 14px" } },
      selectedRecipe ? React.createElement("div", null,
        React.createElement("button", { onClick: function() { setSelectedRecipe(null); },
          style: { marginBottom: 12, padding: "8px 16px", background: "white", border: "1.5px solid " + LIGHT, borderRadius: 20, fontSize: 13, color: "#7a6353", cursor: "pointer" } }, "← Back"),
        React.createElement(RecipeCard, { r: selectedRecipe }),
        React.createElement("div", { style: { fontSize: 12, color: "#7a6353", textAlign: "center", marginBottom: 8 } }, "Saved on " + selectedRecipe.savedAt),
        React.createElement("button", { onClick: function() { deleteRecipe(selectedRecipe.id); },
          style: { width: "100%", padding: "11px", background: "white", border: "1.5px solid #ffaaaa", color: "#c00", borderRadius: 12, fontSize: 14, cursor: "pointer" } }, "🗑 Remove from cookbook")
      ) : React.createElement("div", null,
        React.createElement("input", { value: searchQuery, onChange: function(e) { setSearchQuery(e.target.value); },
          placeholder: "🔍 Search your recipes…",
          style: { width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid " + LIGHT, fontSize: 14, marginBottom: 14, boxSizing: "border-box", background: "white", color: BROWN, outline: "none" } }),
        savedRecipes.length === 0
          ? React.createElement("div", { style: { textAlign: "center", padding: "60px 20px", color: "#7a6353" } },
              React.createElement("div", { style: { fontSize: 50, marginBottom: 12 } }, "📖"),
              React.createElement("div", { style: { fontSize: 16, fontFamily: "Georgia", color: BROWN, marginBottom: 6 } }, "Your cookbook is empty"),
              React.createElement("div", { style: { fontSize: 13 } }, "Chat with the AI chef and save recipes!")
            )
          : filteredRecipes.length === 0
            ? React.createElement("div", { style: { textAlign: "center", padding: "40px 20px", color: "#7a6353", fontSize: 14 } }, "No recipes matching \"" + searchQuery + "\"")
            : React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 12, color: "#7a6353", marginBottom: 12 } }, filteredRecipes.length + " recipe" + (filteredRecipes.length !== 1 ? "s" : "") + " found"),
                filteredRecipes.map(function(r) {
                  return React.createElement("div", { key: r.id, onClick: function() { setSelectedRecipe(r); },
                    style: { background: "white", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    React.createElement("div", null,
                      React.createElement("div", { style: { fontFamily: "Georgia", color: BROWN, fontSize: 15, marginBottom: 3 } }, r.name),
                      React.createElement("div", { style: { fontSize: 12, color: "#7a6353" } }, r.servings + " servings · " + r.difficulty + " · " + r.savedAt)
                    ),
                    React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                      React.createElement("button", { onClick: function(e) { e.stopPropagation(); printRecipe(r); },
                        style: { padding: "4px 10px", background: CREAM, border: "1px solid " + LIGHT, borderRadius: 8, fontSize: 12, cursor: "pointer", color: "#7a6353" } }, "🖨"),
                      React.createElement("span", { style: { color: COPPER, fontSize: 18 } }, "›")
                    )
                  );
                })
              )
      )
    ),

    toast && React.createElement("div", { style: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: BROWN, color: "white", padding: "10px 20px", borderRadius: 20, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", whiteSpace: "nowrap", zIndex: 999 } }, toast),
    React.createElement("style", null, "@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }")
  );
}

ReactDOM.render(React.createElement(App), document.getElementById("root"));
