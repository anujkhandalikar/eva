import { Inngest } from "inngest";

type Events = {
  "task/created": {
    data: {
      id: string;
      input: string;
    };
  };
};

export const inngest = new Inngest({ id: "eva" });
