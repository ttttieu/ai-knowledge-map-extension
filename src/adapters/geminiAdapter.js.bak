/**
 * Gemini Adapter - Optimized for 2026 Angular/NG DOM
 */

export const CONFIG = {
    name: 'Gemini',
    // Sử dụng class đặc trưng của khối markdown Gemini
    messageRow: '.markdown.markdown-main-panel',
    // Vùng chứa nội dung (Gemini thường để trực tiếp trong messageRow)
    contentArea: '.markdown.markdown-main-panel',
    // Selector cho ô nhập liệu của Gemini
    inputField: 'div[role="textbox"], textarea',
    // Nút dừng của Gemini thường có aria-label liên quan đến "Stop" hoặc "Interrupt"
    stopButton: 'button[aria-label*="Stop"], button[aria-label*="ngắt"]'
};

export function findLastResponse() {
    // Gemini đặt ID cho mỗi lần trả lời (ví dụ: id="model-response-message-contentr_...")
    const responses = document.querySelectorAll('div[id^="model-response-message-content"]');
    if (responses.length === 0) return null;
    
    // Lấy phản hồi cuối cùng
    return responses[responses.length - 1];
}

export function extractText(element) {
    if (!element) return '';

    const clone = element.cloneNode(true);

    // Loại bỏ các thành phần Angular thừa và các nút điều hướng của Gemini
    const noise = clone.querySelectorAll(
        'button, ' + 
        'mat-icon, ' + // Các icon của Material Design
        '.copy-button, ' +
        '.add-to-map-button, ' +
        'style, ' +
        '.code-block-decoration' // Tiêu đề của code block (như chữ "JavaScript")
    );
    noise.forEach(n => n.remove());

    // Gemini sử dụng các thuộc tính data-path-to-node để render text theo đoạn
    // innerText vẫn là cách tốt nhất để lấy text đã render sạch sẽ
    return clone.innerText.trim();
}

export function autoFillPrompt(prompt) {
    const input = document.querySelector(CONFIG.inputField);
    if (!input) return false;

    input.focus();
    
    // Đối với các trình soạn thảo dựa trên div (như của Gemini/Angular)
    try {
        // Thử dùng execCommand để giữ đúng định dạng và trigger change detection
        document.execCommand('insertText', false, prompt);
    } catch (e) {
        // Fallback cho textarea truyền thống
        input.value = prompt;
    }
    
    // Trigger các event để Angular nhận biết thay đổi
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

export function isGenerating() {
    const stopBtn = document.querySelector(CONFIG.stopButton);
    // Kiểm tra xem nút stop có đang 'busy' hoặc hiển thị không
    const isBusy = document.querySelector('[aria-busy="true"]');
    return !!(isBusy || (stopBtn && stopBtn.offsetHeight > 0));
}