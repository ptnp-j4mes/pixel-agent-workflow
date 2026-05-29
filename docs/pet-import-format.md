# Codex Pet import format

Zip หนึ่งไฟล์ควรมี:

```txt
pet.json
spritesheet.webp
```

`pet.json` ขั้นต่ำ:

```json
{
  "id": "my-pet",
  "displayName": "My Pet",
  "description": "Custom Codex Pet sprite",
  "spritesheetPath": "spritesheet.webp",
  "kind": "person"
}
```

ค่า default ของ animation:

```json
{
  "columns": 8,
  "rows": 9,
  "animation": {
    "idleRow": 0,
    "runRightRow": 1,
    "runLeftRow": 2,
    "idleFrames": 6,
    "runFrames": 8
  }
}
```
