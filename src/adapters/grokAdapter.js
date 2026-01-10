/**
 * Grok Adapter - Optimized for 2026 Tailwind/React DOM
 */

export const CONFIG = {
    name: 'Grok',
    // Khối bao quanh nội dung phản hồi của Grok
    messageRow: '.response-content-markdown',
    // Vùng chứa nội dung markdown thực tế
    contentArea: '.response-content-markdown',
    // Selector cho ô nhập liệu (thường là textarea hoặc div contenteditable)
    inputField: 'textarea, [contenteditable="true"]',
    // Nút dừng (Grok thường dùng icon hoặc aria-label cụ thể)
    stopButton: 'button[aria-label*="Stop"], button[aria-label*="Cancel"]'
};

export function findLastResponse() {
    const responses = document.querySelectorAll(CONFIG.messageRow);
    if (responses.length === 0) return null;

    // Lấy phản hồi cuối cùng và tìm thẻ cha chứa nó để gắn nút
    const lastBlock = responses[responses.length - 1];
    return lastBlock.closest('.flex.flex-col') || lastBlock;
}

export function extractText(element) {
    if (!element) return '';

    const clone = element.cloneNode(true);

    // Grok có các nút "Sao chép" (Copy) nằm trong khối code rất phức tạp
    const noise = clone.querySelectorAll(
        'button, ' + 
        '.sticky, ' + // Thanh header chứa tên ngôn ngữ và nút copy
        'svg, ' + 
        '.add-to-map-button, ' +
        '[data-testid="code-block"] > div:first-child' // Header của code block
    );
    noise.forEach(n => n.remove());

    // Xử lý shortcode hiển thị đặc biệt (như [mentor_update_form] trong ví dụ của bạn)
    // Grok bọc chúng trong các thẻ span màu cam
    
    let text = clone.innerText.trim();

    // Làm sạch các khoảng trắng thừa do cấu trúc flex/grid của Grok
    text = text.replace(/\n{3,}/g, '\n\n'); 
    
    return text;
}

export function autoFillPrompt(prompt) {
    const input = document.querySelector(CONFIG.inputField);
    if (!input) return false;

    input.focus();
    
    try {
        // Grok thường dùng React, cần trigger thông qua value setter hoặc execCommand
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeInputValueSetter.call(input, prompt);
        
        input.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
        document.execCommand('insertText', false, prompt);
    }
    
    return true;
}

export function isGenerating() {
    // Kiểm tra sự xuất hiện của nút Stop hoặc các hiệu ứng loading đặc thù
    const stopBtn = document.querySelector(CONFIG.stopButton);
    const isStreaming = document.querySelector('.prose-blink, .loading'); 
    return !!(stopBtn || isStreaming);
}