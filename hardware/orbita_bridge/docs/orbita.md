# Orbita C Locking System SDK — v5.6 reference

Markdown reference generated from `ORBITA C Locking System SDK5.6.pdf` (in this
folder). `CLock.dll` is a 32-bit Windows DLL (`__stdcall`) that drives a USB card
encoder; see `../bridge.py` for the HTTP wrapper this project builds around it.

## Functionality at a glance

| Capability | DLL function | Direction | Bridge endpoint | PMS-side use |
|---|---|---|---|---|
| Authorize the interface | *(manual, one-time)* — Orbita lock system dialog | — | — | Done once during setup, see [Integration steps](#integration-steps) |
| Connect to encoder | `dv_connect(beep)` | call | `POST /connect` | Bridge startup / health check |
| Disconnect from encoder | `dv_disconnect()` | call | `POST /disconnect` | Bridge shutdown |
| Encode a card (set room + access window) | `dv_write_card(...)` | write | `POST /write` | `OrbitaProvider.encode_card` — issuing/re-issuing a key card |
| Read a card's contents | `dv_read_card(...)` | read | `POST /read` | Diagnostics / verifying what's on a card |
| Delete a card's data | `dv_delete_card(room)` | write | `POST /delete` | `OrbitaProvider.revoke_card` — revoke / report lost |

Everything below documents each of these in full: [exact C signatures & parameters](#functions),
[error codes](#error-codes), [field widths](#field-reference-widths-used-by-bridgepys-ctypes-buffers),
and [how it all maps onto the PMS](#how-this-maps-onto-the-pms).

## Integration steps

**First — interface authorization**
1. Open the Orbita lock system
2. An authorization dialog box pops up
3. On success, close the lock system dialog

**Second — invoke the functions** (see below)

## Functions

### 1. Connect encoder
```c
__int16 __stdcall dv_connect(__int16 beep);
```
- `beep` [in]: `1` makes the encoder buzzer beep on connect
- Returns `0` on success

### 2. Disconnect encoder
```c
__int16 __stdcall dv_disconnect();
```
- Returns `0` on success

### 3. Read card
```c
__int16 __stdcall dv_read_card(
    unsigned char* cardno,      // [out] card number, 6 chars
    unsigned char* building,    // [out] building number, 2 chars
    unsigned char* room,        // [out] room number, 4 chars
    unsigned char* commdoors,   // [out] common doors, 00-FF (8-bit mask, controls 8 areas)
    unsigned char* arrival,     // [out] check-in time, "yyyy-MM-dd hh:mm:ss", 19 chars
    unsigned char* departure,   // [out] check-out time, same format as arrival
    unsigned char* cardID,      // [out] UUID, 8 chars
    unsigned char* data11       // [out] sector 0 block 11 info, 32 chars
);
```
- Returns `0` on success

### 4. Write card
```c
__int16 __stdcall dv_write_card(
    unsigned char* building,    // [in] building number, 2 chars
    unsigned char* room,        // [in] room number, 4 chars
    unsigned char* commdoors,   // [in] common doors, 00-FF (8-bit mask, controls 8 areas)
    unsigned char* arrival,     // [in] check-in time, "yyyy-MM-dd hh:mm:ss", 19 chars
    unsigned char* departure,   // [in] check-out time, same format as arrival
    unsigned char* suspendnum,  // [in] suspend number, 6 chars
    __int16 mode,               // [in] 1 = report loss, 0 = do not report loss
    unsigned char* data11,      // [in] custom message, 32 chars
    unsigned char* cardID       // [out] UUID returned by the encoder, 8 chars
);
```
- Returns `0` on success
- **Note**: the card's UID/UUID is *assigned by the encoder during write* and
  returned via `cardID` — it is not chosen by the caller beforehand.

### 5. Delete card
```c
__int16 __stdcall dv_delete_card(unsigned char* room);
```
- `room` [in]: room number of the guest card to delete
- Returns `0` on success
- **Note**: deletion is keyed on **room number**, not card UID.
- ⚠️ Writing data to a card overwrites its existing content.

## Error codes

| Code | Meaning |
|------|---------|
| -1   | Interface error |
| -2   | Connect encoder failed |
| -3   | Register encoder failed |
| -4   | Buzzer mute |
| -5   | Not supported card type |
| -6   | Wrong card password |
| -7   | Wrong supplier password |
| -8   | Wrong card type |
| -9   | Wrong authorization code |
| -10  | Find card request failed |
| -11  | Find card failed |
| -12  | Load card password failed |
| -13  | Read device information failed |
| -14  | Read card failed |
| -15  | Write card failed |
| -16  | Reauthorization required |

## Interface demo (`obt.exe`, included in the SDK kit)

1. Open `obt.exe`
2. Click **Connect**
3. **Write card**: fill in the fields, place the guest card on the encoder, click "Write data"
4. **Read card**: place the card on the encoder, click "Read data"
5. **Delete card**: place the card on the encoder, click "Delete data"

## Field reference (widths used by `bridge.py`'s ctypes buffers)

| Field        | Chars | Notes |
|--------------|-------|-------|
| cardno       | 6     | output only (read) |
| building     | 2     | e.g. `"01"` |
| room         | 4     | e.g. `"0101"` |
| commdoors    | 2     | hex `00`-`FF`, 8-bit mask for 8 common-door areas |
| arrival      | 19    | `yyyy-MM-dd hh:mm:ss` — card access window start |
| departure    | 19    | `yyyy-MM-dd hh:mm:ss` — card access window end |
| suspendnum   | 6     | |
| cardID/UUID  | 8     | assigned by the encoder on write, returned on read/write |
| data11       | 32    | custom message / sector 0 block 11 |

## How this maps onto the PMS

- `dv_write_card`'s `arrival`/`departure` are exactly the "timer" fields used for
  scheduled-validity cards (e.g. a day-use card for room 101, 14:00–17:00) — see
  `OrbitaProvider.encode_card` in `backend/app/services/keycard_service.py`,
  which formats the PMS's `valid_from`/`expires_at` into these fields.
- The lock checks `arrival`/`departure` against its own clock when the card is
  presented — this is fully offline; the lock does not need to be networked.
- Energy-saver switches are a **separate system** — this SDK has no concept of
  them. Standard "insert any card" energy savers work independently of Orbita
  cards/locks; only an Orbita-compatible *smart* energy saver could read the
  `arrival`/`departure` data, and the SDK does not document that integration.
