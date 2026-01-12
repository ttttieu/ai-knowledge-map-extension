# 🗺️ Knowledge Map Extension

> Biến cuộc hội thoại AI thành bản đồ tư duy trực quan

**Knowledge Map** là tiện ích Chrome giúp bạn thu thập, tổ chức và trực quan hóa kiến thức từ các cuộc hội thoại với ChatGPT, Claude, Gemini và Grok. Được xây dựng hoàn toàn bằng **Vanilla JavaScript** - không cần build, không cần Node.js.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## ✨ Tính năng chính

### 🎯 Thu thập thông minh
- **Một click** thêm nội dung AI vào bản đồ
- **Tự xây dựng** nodes theo các nội dung:
  - 📌 **TITLE**: Tên node
  - 📝 **SUMMARY**: Khái niệm chính, nội dung cốt lõi
  - 💡 **GỢI MỞ/NEXT STEPS**: Ý tưởng mở rộng, gợi ý khám phá từ cuộc hội thoại
  - **Scoll to Source Message**: Nút bấm để xem lại toàn bộ nội dung của node nếu đang trong cuôc hội thoại
  - ↗️**Open coversation**: Chuyển đến đúng cuộc hội thoại nếu đang ở ngoài
  - 📎**Previous in Conversation**, kết hợp cùng GỢI MỞ/NEXT STEPS để định vị lại trong luồng tư duy

### 📁 Quản lý đa dự án
- Tạo nhiều project riêng biệt
- Chuyển đổi nhanh giữa các project
- Mỗi project lưu trữ độc lập
- Tự động nhớ project cuối cùng

### 🔄 Auto Layout thông minh
- **Force-Directed**: Thuật toán lực đẩy tự động bung nodes đẹp mắt
- **Grid Layout**: Sắp xếp theo lưới có cấu trúc - Mặc định
- **Radial Layout**: CORE ở tâm, EXPANSION xung quanh

### 💾 Lưu trữ an toàn
- Dữ liệu lưu local trong Chrome Storage
- Không gửi dữ liệu lên server
- Tự động persist mọi thay đổi

---

## 🚀 Cài đặt

### Cách 1: Từ mã nguồn (Developer)

```bash
# Clone repository
git clone https://github.com/ttttieu/knowledge-map-extension.git
cd knowledge-map-extension
```

### Cách 2: Tải ZIP

1. Tải file ZIP từ Releases
2. Giải nén vào thư mục bất kỳ

### Load vào Chrome

1. Mở `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Click **Load unpacked**
4. Chọn thư mục chứa `manifest.json`

---

## 📖 Hướng dẫn sử dụng

### Bước 1: Tạo Project

1. Click icon extension trên toolbar → Mở Side Panel
2. Click **➕** để tạo project mới
3. Đặt tên project (VD: "Học Machine Learning")

### Bước 2: Thu thập kiến thức

1. Truy cập ChatGPT / Claude / Gemini / Grok
2. Hỏi AI bất kỳ điều gì
3. Khi AI trả lời xong, click nút **📍 Add to Map**
4. Nodes tự động xuất hiện trong Side Panel

### Bước 3: Khám phá bản đồ

| Thao tác | Chức năng |
|----------|-----------|
| **Click node** | Xem chi tiết nội dung |
| **Kéo thả** | Di chuyển node |
| **Scroll** | Zoom in/out |
| **📊 Grid** | Sắp xếp dạng lưới |
| **🎯 Radial** | Bố cục hình tròn |


---

## 📂 Cấu trúc dự án

```
/knowledge-map-extension
├── manifest.json              # Chrome Extension Manifest V3
├── icons/                     # Extension icons
│
└── src/
    ├── content.js             # Inject buttons vào trang AI
    │
    ├── adapters/              # Platform adapters
    │   ├── adapterFactory.js  # Detect & load adapter
    │   ├── chatgptAdapter.js  # ChatGPT selectors
    │   ├── claudeAdapter.js   # Claude selectors
    │   ├── geminiAdapter.js   # Gemini selectors
    │   └── grokAdapter.js     # Grok selectors
    │
    ├── core/
    │   ├── background.js      # Service Worker
    │   ├── database.js        # IndexedDB với Dexie.js
    │   ├── nlpProcessor.js    # Phân tích văn bản
    │   └── layoutUtils.js     # Layout algorithms
    │
    ├── sidepanel/             # Side Panel UI (mới)
    │   ├── index.html         # HTML structure
    │   ├── index.js           # Main logic + Multi-project
    │   ├── autoLayout.js      # Force-directed algorithm
    │   └── styles.css         # Styling
    │
    ├── styles/
    │   └── inject.css         # Button styles cho mỗi platform
    │
    ├── utils/
    │   └── smartParser.js     # Parse tables, lists, text
    │
    └── assets/
        ├── cytoscape.min.js   # Graph visualization
        └── dexie.min.js       # IndexedDB wrapper
```

---

## ⚙️ Cấu hình Manifest V3

```json
{
  "permissions": ["sidePanel", "storage", "activeTab"],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://grok.com/*"
  ],
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  }
}
```

---

## 🌐 Nền tảng hỗ trợ

| Platform | URL | Status |
|----------|-----|--------|
| ChatGPT | `chatgpt.com` | ✅ Supported |
| Claude | `claude.ai` | ✅ Supported |
| Gemini | `gemini.google.com` | ✅ Supported |
| Grok | `grok.com` | ✅ Supported |

---

## 🔒 Bảo mật & Quyền riêng tư

- ✅ **Không thu thập dữ liệu** - Mọi thứ lưu local
- ✅ **Không gửi lên server** - Hoạt động offline
- ✅ **Mã nguồn mở** - Có thể audit code
- ✅ **Manifest V3** - Chuẩn bảo mật mới nhất của Chrome

---

## 🛠 Phát triển

### Yêu cầu
- Chrome 116+ (hỗ trợ Side Panel API)
- Không cần Node.js / npm

### Debug
1. Mở `chrome://extensions/`
2. Click **Inspect views: service worker** để debug background
3. Click chuột phải Side Panel → Inspect để debug UI

### Thêm platform mới

1. Tạo file `src/adapters/newPlatformAdapter.js`
2. Implement các methods:
   - `findLastResponse()` - Tìm element chứa response
   - `extractText(element)` - Lấy text từ element
   - `isGenerating()` - Check AI đang generate
   - `autoFillPrompt(text)` - Điền text vào input
3. Đăng ký trong `adapterFactory.js`
4. Thêm URL vào `manifest.json`

---

## 📝 Changelog

### v1.1.0 (Current)
- ✨ Multi-project management
- ✨ Grid & Radial layout options
- ✨ Delete individual nodes
- 🔧 Refactored to vanilla JS Side Panel
- 🔧 Improved storage schema

### v1.0.0
- 🎉 Initial release
- Basic node extraction
- Cytoscape visualization
- IndexedDB storage

---

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh:

1. Fork repository
2. Tạo branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Tạo Pull Request

**Ưu tiên:**
- Cải thiện selectors cho các AI platforms
- Tối ưu thuật toán layout
- Thêm các định dạng export mới
- UI/UX improvements

---

## 📄 License

MIT License - Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

<p align="center">
  Made with ❤️ for AI miners
</p>
