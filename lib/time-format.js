/**
 * 把秒數格式化成 M:SS。
 * 超過一小時不進位成 H:MM:SS，因為 Instagram 影片不會這麼長，
 * 統一格式讓標籤寬度可預測。
 */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
