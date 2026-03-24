import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-black font-display text-primary mb-4">404</h1>
      <p className="text-xl font-bold text-foreground mb-8">页面未找到</p>
      <Link href="/" className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all">
        返回首页
      </Link>
    </div>
  );
}
