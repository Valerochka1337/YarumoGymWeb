import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="loading">
        <h1>Не удалось открыть дневник</h1>
        <p>
          Проверьте, что браузеру разрешено локальное хранение и на устройстве
          есть свободное место. Данные не очищены.
        </p>
        <button onClick={() => location.reload()}>Открыть снова</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
