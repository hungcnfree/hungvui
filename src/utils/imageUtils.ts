/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * imageUtils: Hỗ trợ nén và xử lý ảnh đính kèm cho câu hỏi môn Công Nghệ
 * Giúp ảnh dung lượng lớn từ điện thoại/máy tính được nén gọn (<80KB),
 * đảm bảo lưu trữ mượt mà trong LocalStorage và hiển thị sắc nét trên máy chiếu.
 */

export function compressImageFile(file: File, maxDimension = 1000, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    // Nếu là file SVG, giữ nguyên text dạng Data URL
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        // Vẽ nền trắng trong trường hợp ảnh PNG trong suốt xuất sang JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        // Fallback đọc trực tiếp
        resolve(event.target?.result as string);
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
