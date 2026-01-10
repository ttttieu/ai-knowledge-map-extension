/**
 * Claude Adapter - Optimized for 2026 Grid-based DOM
 */

export const CONFIG = {
    name: 'Claude',
    // Claude dùng class này cho khối bao quanh toàn bộ câu trả lời
    messageRow: '.font-claude-response-body, .standard-markdown', 
    // Vùng chứa nội dung thực sự (Claude hay lồng trong thẻ grid)
    contentArea: '.standard-markdown',
    // Claude dùng div contenteditable hoặc textarea tùy phiên bản
    inputField: 'div[contenteditable="true"], textarea[placeholder*="Claude"]',
    stopButton: 'button[aria-label*="Stop"], button svg path[d*="M6 6h8v8H6z"]' // Nút dừng hình vuông
};

export function findLastResponse() {
    // Tìm tất cả các khối tin nhắn của Claude
    const containers = document.querySelectorAll('.standard-markdown');
    if (containers.length === 0) return null;

    // Claude thường render nhiều khối markdown trong một lượt trả lời
    // Chúng ta lấy khối cha chứa toàn bộ câu trả lời đó
    const lastBlock = containers[containers.length - 1];
    return lastBlock.closest('.flex-col') || lastBlock;
}

export function extractText(element) {
    if (!element) return '';

    const clone = element.cloneNode(true);

    // Claude có rất nhiều nút phụ (Copy, Retry) nằm xen kẽ trong text
    const noise = clone.querySelectorAll(
        'button, ' + 
        '.opacity-0, ' + // Các nút ẩn chỉ hiện khi hover
        '.add-to-map-button, ' +
        'svg, ' + 
        '.text-text-500.font-small' // Nhãn ngôn ngữ (yaml, javascript) trong code block
    );
    noise.forEach(n => n.remove());

    // Trích xuất text sạch
    let text = clone.innerText.trim();

    // Xử lý các khoảng trắng thừa do cấu trúc grid của Claude
    text = text.replace(/\n{3,}/g, '\n\n'); 
    
    return text;
}

export function autoFillPrompt(prompt) {
    const input = document.querySelector(CONFIG.inputField);
    if (!input) return false;

    input.focus();
    
    // Claude sử dụng thư viện Lexical hoặc ProseMirror
    // insertText là cách an toàn nhất để vượt qua logic quản lý state của họ
    try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, prompt);
    } catch (e) {
        input.innerText = prompt;
    }
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
}

export function isGenerating() {
    // Claude thay đổi nút "Gửi" thành nút "Dừng" (hình vuông)
    const stopBtn = document.querySelector(CONFIG.stopButton);
    return !!(stopBtn && stopBtn.offsetParent !== null);
}