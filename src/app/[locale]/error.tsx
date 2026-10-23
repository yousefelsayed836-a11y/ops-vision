"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page" dir="rtl">
      <h1>تعذر تحميل الصفحة / Unable to load</h1>
      <button onClick={reset}>إعادة المحاولة / Retry</button>
    </main>
  );
}
