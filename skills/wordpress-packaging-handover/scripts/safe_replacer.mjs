/**
 * Module Safe Serialized URL Replacer (safe_replacer.mjs)
 * 
 * Thuật toán tìm kiếm & thay thế URL an toàn cho WordPress:
 * - Thay thế chính xác trong các trường PHP Serialized (s:<byte_count>:"<string>";)
 * - Tự động tính toán lại độ dài byte UTF-8 bằng Buffer.byteLength() (chuẩn PHP serialize)
 * - Đảm bảo không làm hỏng cấu trúc dữ liệu serialized của Flatsome UX Builder, WooCommerce, ACF
 * - Hỗ trợ cả chuỗi escape trong MySQL Dump (s:<len>:\"<string>\";)
 * - Đồng thời thay thế an toàn các URL không nằm trong serialize (URL thô trong SQL / post_content)
 */

import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Thay thế URL an toàn trong nội dung WordPress (hỗ trợ cả serialized data và raw strings)
 *
 * @param {string} rawContent - Chuỗi văn bản thô (có thể là JSON, SQL dump, post_content, hoặc serialized string)
 * @param {string} oldUrl - URL cũ cần tìm kiếm
 * @param {string} newUrl - URL mới thay thế
 * @returns {string} Chuỗi sau khi đã thay thế an toàn với độ dài byte được cập nhật chuẩn xác
 */
export function safeReplaceSerialized(rawContent, oldUrl, newUrl) {
  if (typeof rawContent !== 'string') {
    return rawContent;
  }
  if (!oldUrl || oldUrl === newUrl || !rawContent.includes(oldUrl)) {
    return rawContent;
  }

  // Regex nhận diện cấu trúc serialized string: s:<length>:"<content>"; hoặc s:<length>:\"<content>\";
  const regex = /s:(\d+):(\\?")([\s\S]*?)\2;/g;
  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(rawContent)) !== null) {
    const [fullMatch, lenStr, quote, initialContent] = match;
    const matchIndex = match.index;
    const declaredLen = parseInt(lenStr, 10);

    let content = initialContent;
    let actualFullMatch = fullMatch;
    let fullMatchLength = fullMatch.length;

    // Kiểm tra trường hợp content chứa ký tự "; bên trong khiến regex dừng sớm hơn độ dài thực tế
    let currentByteLen = Buffer.byteLength(content, 'utf8');
    if (currentByteLen < declaredLen) {
      const quoteSemicolon = quote + ';';
      let searchPos = matchIndex + fullMatchLength;
      while (currentByteLen < declaredLen && searchPos < rawContent.length) {
        const nextClosing = rawContent.indexOf(quoteSemicolon, searchPos);
        if (nextClosing === -1) {
          break;
        }
        const candidateFull = rawContent.slice(matchIndex, nextClosing + quoteSemicolon.length);
        const candidateContent = rawContent.slice(matchIndex + `s:${lenStr}:${quote}`.length, nextClosing);
        currentByteLen = Buffer.byteLength(candidateContent, 'utf8');
        if (currentByteLen === declaredLen) {
          content = candidateContent;
          actualFullMatch = candidateFull;
          fullMatchLength = candidateFull.length;
          regex.lastIndex = nextClosing + quoteSemicolon.length;
          break;
        }
        searchPos = nextClosing + 1;
      }
    }

    // 1. Xử lý đoạn văn bản không phải serialized nằm trước token hiện tại
    if (matchIndex > lastIndex) {
      const nonSerialized = rawContent.slice(lastIndex, matchIndex);
      result += nonSerialized.replaceAll(oldUrl, newUrl);
    }

    // 2. Xử lý token serialized hiện tại
    if (content.includes(oldUrl)) {
      const replacedContent = content.replaceAll(oldUrl, newUrl);
      const newByteLen = Buffer.byteLength(replacedContent, 'utf8');
      result += `s:${newByteLen}:${quote}${replacedContent}${quote};`;
    } else {
      result += actualFullMatch;
    }

    lastIndex = matchIndex + fullMatchLength;
  }

  // 3. Xử lý đoạn văn bản không phải serialized còn lại ở cuối chuỗi
  if (lastIndex < rawContent.length) {
    const trailing = rawContent.slice(lastIndex);
    result += trailing.replaceAll(oldUrl, newUrl);
  }

  return result;
}

// Hỗ trợ thực thi trực tiếp từ CLI nếu cần test nhanh hoặc chạy file
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Cách dùng: node safe_replacer.mjs <file_hoac_chuoi> <oldUrl> <newUrl>');
    process.exit(0);
  }

  const [inputTarget, searchUrl, replaceUrl] = args;
  if (fs.existsSync(inputTarget)) {
    const content = fs.readFileSync(inputTarget, 'utf8');
    const replaced = safeReplaceSerialized(content, searchUrl, replaceUrl);
    fs.writeFileSync(inputTarget, replaced, 'utf8');
    console.log(`Đã thay thế an toàn file: ${inputTarget}`);
  } else {
    console.log(safeReplaceSerialized(inputTarget, searchUrl, replaceUrl));
  }
}
