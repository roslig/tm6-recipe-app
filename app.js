import { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "tm6-cookbook-v1";
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

export default function TM6Cookbook() {
  const [tab, setTab] = useState("chat");
  const [language, setLanguage] = useState("English");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm your personal TM6 chef 👨‍🍳 Ask me for any recipe, upload a fridge photo, or browse your saved cookbook!" }
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
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function loadRecipes() {
    try {
      const result = await window.storage.get(STORAGE_KEY);
      if (result) setSavedRecipes(JSON.parse(result.value));
    } catch (e) { setSavedRecipes([]); }
  }

  async function saveRecipe() {
    if (!recipe) return;
    setSaving(true);
    try {
      const toSave = { ...recipe, id: Date.now(), savedAt: new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) };
      const updated = [toSave, ...savedRecipes];
      setSavedRecipes(updated);
      await window.storage.set(STORAGE_KEY, JSON.stringify(updated));
      showToast("Saved to your cookbook! 📖");
    } catch (e) { showToast("Could not save. Try again."); }
    finally { setSaving(false); }
  }

  async function deleteRecipe(id) {
    const updated = savedRecipes.filter(r => r.id !== id);
    setSavedRecipes(updated);
    await window.storage.set(STORAGE_KEY, JSON.stringify(updated));
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

  // When language changes, add a system message to the chat
  function handleLanguageChange(lang) {
    setLanguage(lang);
    const label = LANGUAGES.find(l => l.code === lang)?.label || lang;
    setMessages(prev => [...prev, {
      role: "assistant",
      content: lang === "English"
        ? "Switched to English 🇬🇧 How can I help you?"
        : lang === "Bahasa Malaysia"
        ? "Saya kini akan membalas dalam Bahasa Malaysia 🇲🇾 Apa yang anda ingin masak?"
        : lang === "Mandarin Chinese"
        ? "我现在将用中文回复您 🇨🇳 您想做什么菜？"
        : "நான் இப்போது தமிழில் பதில் சொல்கிறேன் 🇮🇳 என்ன சமைக்க விரும்புகிறீர்கள்?"
    }]);
  }

  async function sendMessage() {
    if ((!input.trim() && !image) || loading) return;

    const userContent = image
      ? `📷 [Photo uploaded] ${input.trim() || "What can I make with these ingredients?"}`
      : input.trim();

    const userMessage = { role: "user", content: userContent };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const historyText = updatedMessages
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const currentRecipe = recipe ? `\n\nCurrent recipe on screen: ${JSON.stringify(recipe)}` : "";

    // KEY CHANGE: language instruction added to prompt
    const prompt = `You are an expert Thermomix TM6 cooking assistant with a warm, friendly personality.
IMPORTANT: You must respond ENTIRELY in ${language}. Every word — the message, recipe name, description, ingredients, steps, and tip — must be in ${language}.
All weights in grams only. For TM6 steps include settings like [Speed 5 / 100°C / 5 min].${currentRecipe}
${image ? "The user has uploaded a photo of their fridge/ingredients. Identify what you can see and suggest the best recipe." : ""}

--- Conversation ---
${historyText}
--- End ---

Reply as Assistant. Respond ONLY with a JSON object:
{
  "message": "Your warm friendly chat reply in ${language}",
  "recipe": {
    "name": "Recipe name in ${language}",
    "description": "One sentence description in ${language}",
    "prepTime": "X min",
    "cookTime": "X min",
    "difficulty": "Easy or Medium or Hard",
    "servings": 4,
    "ingredients": ["200g item in ${language}"],
    "steps": ["Step in ${language} [Speed 4 / 100°C / 5 min]"],
    "tip": "Tip in ${language}"
  }
}
If not about a recipe, set "recipe" to null.
ONLY valid JSON. No backticks. No extra text.`;

    try {
      const msgContent = image ? [
        { type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } },
        { type: "text", text: prompt }
      ] : prompt;

      const response = await window.claude.complete(typeof msgContent === "string" ? msgContent : JSON.stringify(msgContent));
      const cleaned = response.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      setMessages(prev => [...prev, { role: "assistant", content: parsed.message }]);
      if (parsed.recipe) setRecipe(parsed.recipe);
      setImage(null); setImageUrl(null);

    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again!" }]);
    } finally { setLoading(false); }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function printRecipe(r) {
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>${r.name}</title>
      <style>
        body { font-family: Georgia, serif; padding: 40px; color: #3d2b1f; max-width: 700px; margin: 0 auto; }
        h1 { color: #b5651d; } h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .badge { display: inline-block; background: #f0e8d8; padding: 4px 12px; border-radius: 20px; font-size: 13px; margin-right: 6px; }
        li { margin-bottom: 6px; font-size: 14px; line-height: 1.6; }
        .tip { background: #fff8f0; border-left: 4px solid #b5651d; padding: 10px 14px; font-style: italic; font-size: 13px; margin-top: 16px; }
        button { margin-top: 20px; padding: 10px 20px; background: #b5651d; color: white; border: none; border-radius: 8px; cursor: pointer; }
        @media print { button { display: none; } }
      </style></head><body>
      <h1>${r.name}</h1><p>${r.description}</p>
      <p><span class="badge">⏱ ${r.prepTime}</span><span class="badge">🔥 ${r.cookTime}</span><span class="badge">👥 ${r.servings}</span><span class="badge">${r.difficulty}</span></p>
      <div class="grid">
        <div><h2>Ingredients</h2><ul>${r.ingredients.map(i => `<li>${i}</li>`).join("")}</ul></div>
        <div><h2>Method</h2><ol>${r.steps.map(s => `<li>${s}</li>`).join("")}</ol></div>
      </div>
      ${r.tip ? `<div class="tip">💡 ${r.tip}</div>` : ""}
      <button onclick="window.print()">🖨 Print</button>
      </body></html>`);
    win.document.close();
  }

  const diffColor = { "Easy": GREEN, "Medium": COPPER, "Hard": "#c0392b" };
  const filteredRecipes = savedRecipes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  function RecipeCard({ r }) {
    return (
      <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", marginBottom: 12 }}>
        <div style={{ background: BROWN, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: "white", fontFamily: "Georgia", fontSize: "1.1rem", margin: "0 0 4px" }}>{r.name}</h2>
              <p style={{ color: "#c4a882", fontSize: 12, margin: "0 0 10px" }}>{r.description}</p>
            </div>
            <button onClick={() => printRecipe(r)} title="Print"
              style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "white", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>🖨</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ l: "⏱", v: r.prepTime }, { l: "🔥", v: r.cookTime }, { l: "👥", v: r.servings }].map((b, i) => (
              <span key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "white" }}>{b.l} {b.v}</span>
            ))}
            <span style={{ background: diffColor[r.difficulty] || COPPER, borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "white", fontWeight: 600 }}>{r.difficulty}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ padding: "12px 14px", borderRight: `1px solid ${LIGHT}` }}>
            <div style={{ fontSize: 11, color: COPPER, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Ingredients</div>
            {r.ingredients.map((ing, i) => (
              <div key={i} style={{ fontSize: 12, color: "#4a3728", marginBottom: 4, display: "flex", gap: 6 }}>
                <span style={{ color: COPPER }}>•</span><span>{ing}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: COPPER, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Method</div>
            {r.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 17, height: 17, borderRadius: "50%", background: COPPER, color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                <p style={{ fontSize: 12, color: "#4a3728", margin: 0, lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
        {r.tip && (
          <div style={{ background: "#fff8f0", borderTop: `1px solid ${LIGHT}`, padding: "10px 14px", fontSize: 12, color: "#7a6353" }}>
            <strong style={{ color: COPPER }}>💡 </strong>{r.tip}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", background: CREAM, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: BROWN, padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: COPPER, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👨‍🍳</div>
            <div>
              <div style={{ color: "white", fontWeight: 600, fontSize: 16, fontFamily: "Georgia" }}>TM6 <em style={{ color: "#c4a882" }}>Cookbook</em></div>
              <div style={{ color: "#7a6353", fontSize: 11 }}>Your AI-powered recipe companion</div>
            </div>
          </div>

          {/* Language selector */}
          <select value={language} onChange={e => handleLanguageChange(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 20, border: "none", background: "rgba(255,255,255,0.15)", color: "white", fontSize: 12, cursor: "pointer", outline: "none" }}>
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code} style={{ background: BROWN, color: "white" }}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {[{ id: "chat", label: "💬 Chef Chat" }, { id: "cookbook", label: `📖 Cookbook (${savedRecipes.length})` }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelectedRecipe(null); }}
              style={{ padding: "7px 16px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: tab === t.id ? COPPER : "rgba(255,255,255,0.1)", color: "white" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT TAB */}
      {tab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {recipe && (
            <div style={{ padding: "12px 14px 0", overflowY: "auto", maxHeight: "50vh" }}>
              <RecipeCard r={recipe} />
              <button onClick={saveRecipe} disabled={saving}
                style={{ width: "100%", padding: "11px", background: saving ? "#ccc" : GREEN, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", marginBottom: 4 }}>
                {saving ? "Saving…" : "💾 Save to Cookbook"}
              </button>
            </div>
          )}

          {imageUrl && (
            <div style={{ padding: "8px 14px 0", display: "flex", alignItems: "center", gap: 10 }}>
              <img src={imageUrl} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10 }} alt="upload" />
              <div style={{ fontSize: 13, color: "#7a6353" }}>Photo ready to send</div>
              <button onClick={() => { setImage(null); setImageUrl(null); }}
                style={{ padding: "4px 10px", background: "white", border: `1px solid ${LIGHT}`, borderRadius: 8, fontSize: 12, color: "#7a6353", cursor: "pointer" }}>✕</button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.role === "user" ? COPPER : "white", color: msg.role === "user" ? "white" : BROWN, fontSize: 13, lineHeight: 1.6, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex" }}>
                <div style={{ background: "white", borderRadius: "16px 16px 16px 4px", padding: "10px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", display: "flex", gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: COPPER, animation: "bounce 1s infinite", animationDelay: `${i*0.2}s` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "10px 14px", background: "white", borderTop: `1px solid ${LIGHT}`, display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => fileRef.current.click()}
              style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${LIGHT}`, background: CREAM, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>📷</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Ask for a recipe, say 'make it spicier', or upload a 📷…"
              rows={1} style={{ flex: 1, padding: "9px 13px", borderRadius: 18, border: `1.5px solid ${LIGHT}`, fontSize: 13, fontFamily: "sans-serif", resize: "none", outline: "none", background: CREAM, color: BROWN }} />
            <button onClick={sendMessage} disabled={loading || (!input.trim() && !image)}
              style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: (loading || (!input.trim() && !image)) ? "#ddd" : COPPER, color: "white", fontSize: 16, cursor: (loading || (!input.trim() && !image)) ? "not-allowed" : "pointer", flexShrink: 0 }}>➤</button>
          </div>
        </div>
      )}

      {/* COOKBOOK TAB */}
      {tab === "cookbook" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
          {selectedRecipe ? (
            <div>
              <button onClick={() => setSelectedRecipe(null)}
                style={{ marginBottom: 12, padding: "8px 16px", background: "white", border: `1.5px solid ${LIGHT}`, borderRadius: 20, fontSize: 13, color: "#7a6353", cursor: "pointer" }}>← Back</button>
              <RecipeCard r={selectedRecipe} />
              <div style={{ fontSize: 12, color: "#7a6353", textAlign: "center", marginBottom: 8 }}>Saved on {selectedRecipe.savedAt}</div>
              <button onClick={() => deleteRecipe(selectedRecipe.id)}
                style={{ width: "100%", padding: "11px", background: "white", border: "1.5px solid #ffaaaa", color: "#c00", borderRadius: 12, fontSize: 14, cursor: "pointer" }}>
                🗑 Remove from cookbook
              </button>
            </div>
          ) : (
            <div>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="🔍 Search your recipes…"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${LIGHT}`, fontSize: 14, marginBottom: 14, boxSizing: "border-box", background: "white", color: BROWN, outline: "none" }} />
              {savedRecipes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#7a6353" }}>
                  <div style={{ fontSize: 50, marginBottom: 12 }}>📖</div>
                  <div style={{ fontSize: 16, fontFamily: "Georgia", color: BROWN, marginBottom: 6 }}>Your cookbook is empty</div>
                  <div style={{ fontSize: 13 }}>Chat with the AI chef and save recipes!</div>
                </div>
              ) : filteredRecipes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#7a6353", fontSize: 14 }}>No recipes matching "{searchQuery}"</div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: "#7a6353", marginBottom: 12 }}>{filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? "s" : ""} found</div>
                  {filteredRecipes.map(r => (
                    <div key={r.id} onClick={() => setSelectedRecipe(r)}
                      style={{ background: "white", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontFamily: "Georgia", color: BROWN, fontSize: 15, marginBottom: 3 }}>{r.name}</div>
                        <div style={{ fontSize: 12, color: "#7a6353" }}>{r.servings} servings · {r.difficulty} · {r.savedAt}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button onClick={e => { e.stopPropagation(); printRecipe(r); }}
                          style={{ padding: "4px 10px", background: CREAM, border: `1px solid ${LIGHT}`, borderRadius: 8, fontSize: 12, cursor: "pointer", color: "#7a6353" }}>🖨</button>
                        <span style={{ color: COPPER, fontSize: 18 }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: BROWN, color: "white", padding: "10px 20px", borderRadius: 20, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", whiteSpace: "nowrap", zIndex: 999 }}>
          {toast}
        </div>
      )}

      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }`}</style>
    </div>
  );
}
