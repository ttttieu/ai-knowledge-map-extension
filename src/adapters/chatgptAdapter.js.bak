/**
 * ChatGPT Adapter - Optimized for 2026 Granular DOM
 */

export const CONFIG = {
    name: 'ChatGPT',
    // Khối bao quanh toàn bộ câu trả lời của AI
    messageRow: 'div[data-message-author-role="assistant"]', 
    // Vùng chứa văn bản thực sự
    contentArea: '.markdown.prose',
    inputField: '#prompt-textarea',
    stopButton: 'button[aria-label*="Stop"]'
};

export function findLastResponse() {
    const responses = document.querySelectorAll(CONFIG.messageRow);
    return responses.length > 0 ? responses[responses.length - 1] : null;
}

export function extractText(element) {
    if (!element) return '';

    // Ưu tiên lấy trong vùng markdown để loại bỏ avatar và nút hệ thống
    const contentNode = element.querySelector(CONFIG.contentArea);
    const target = contentNode || element;

    // Clone để xử lý không làm hỏng giao diện gốc
    const clone = target.cloneNode(true);

    // Xóa các thành phần gây nhiễu thường xuất hiện trong ChatGPT
    // 1. Nút "Sao chép" của bảng (như trong HTML bạn gửi)
    // 2. Nút "📍 Add to Map" của chính mình
    // 3. Các thành phần hỗ trợ đọc (screen reader)
    const noise = clone.querySelectorAll('button, .sr-only, .add-to-map-button, [aria-label*="copy"]');
    noise.forEach(n => n.remove());

    // Trả về innerText (giữ được xuống dòng và cấu trúc bảng đơn giản)
    return clone.innerText.trim();
}

export function autoFillPrompt(prompt) {
    const input = document.querySelector(CONFIG.inputField);
    if (!input) return false;

    input.focus();
    // Đối với ChatGPT, đôi khi cần dùng execCommand để trigger state của React
    document.execCommand('insertText', false, prompt);
    
    // Dispatch thêm event để chắc chắn nút Send hiện lên
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
}

export function isGenerating() {
    const stopBtn = document.querySelector(CONFIG.stopButton);
    // Kiểm tra nút Stop có đang hiển thị thực tế không
    return !!(stopBtn && stopBtn.offsetWidth > 0 && stopBtn.offsetHeight > 0);
}