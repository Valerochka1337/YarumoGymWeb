import SparkMD5 from "spark-md5";
/** Java UUID.nameUUIDFromBytes, deliberately without a namespace prefix. Not a security hash. */
export function nameUUID(text: string) {
  const hex = SparkMD5.hash(text),
    bytes = Array.from({ length: 16 }, (_, i) =>
      parseInt(hex.slice(i * 2, i * 2 + 2), 16),
    );
  bytes[6] = (bytes[6] & 15) | 48;
  bytes[8] = (bytes[8] & 63) | 128;
  const s = bytes.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export const profileId = (owner: string) =>
  nameUUID(`ValerochkaGym.profile.v1:${owner}`);
export const exceptionId = (ruleId: string, key: string) =>
  nameUUID(`ValerochkaGym.calendar-exception:v1:${ruleId}:${key}`);
