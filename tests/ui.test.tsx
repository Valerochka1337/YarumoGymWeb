import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { Form, Field, AppContext } from "../src/ui";
it("retains user input after a storage failure and reports it", async () => {
  const message = vi.fn();
  render(
    <AppContext.Provider
      value={{
        owner: "guest",
        message,
        run: async (fn) => {
          try {
            await fn();
          } catch (e) {
            message((e as Error).message);
          }
        },
      }}
    >
      <Form
        onSave={async () => {
          throw new Error("QuotaExceededError");
        }}
      >
        <Field label="Название">
          <input name="name" />
        </Field>
      </Form>
    </AppContext.Provider>,
  );
  fireEvent.change(screen.getByLabelText("Название"), {
    target: { value: "Несохранённая программа" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(message).toHaveBeenCalledWith("QuotaExceededError"),
  );
  expect(screen.getByLabelText("Название")).toHaveValue(
    "Несохранённая программа",
  );
});
