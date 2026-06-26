import { handleRoomsRequest } from "../../../src/routes/rooms.js";
import { handleOptions, toRequest, writeResponse } from "../../_bridge";

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;

  const response = await handleRoomsRequest(await toRequest(req));
  if (!response) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  await writeResponse(res, response);
}
