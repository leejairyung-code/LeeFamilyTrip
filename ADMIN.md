# How to update the trip site (no coding needed)

Everything you can change lives in the **`content`** folder on GitHub. Each file is one section of the site. After you save a change, the site rebuilds by itself in about one minute. Visitors see a "New version available. Tap to refresh." banner the next time they open it.

## The 5 steps (same for every file)

1. On GitHub, open the repository, then the `content` folder, then the file you want.
2. Click the **pencil icon** (Edit this file).
3. Change the text between the quote marks. Do not touch the commas, quotes and brackets around it.
4. Click **Commit changes**, then **Commit changes** again.
5. Open the **Actions** tab. A green check means the site is live. A red cross means a mistake was found. Click it to read a plain message that says which file and which line to fix.

## Rules for text

- Every sentence has two versions side by side: `"en"` for English and `"ko"` for Korean. Fill in **both**. If one is empty, the site will not build and tells you which one is missing.
- Times, addresses, phone numbers and links are written **once**, with no language.
- Anything that says `TODO` is still waiting for you. The build lists every remaining TODO. Replace the whole text, including the word TODO.
- Keep the quote marks `"` and put a comma `,` after each item except the last one in a group. A missing comma is the most common mistake.

## What each file does

### `itinerary.json` (the day-by-day plan)
Each day has a list of `items`. One item looks like this:

```json
{ "time": "12:15", "type": "reserve",
  "title": { "en": "Lunch for 8", "ko": "점심 (8명)" },
  "note":  { "en": "Ask for a ground-floor table.", "ko": "1층 자리로 부탁하기." } }
```

- `time`: 24-hour clock, like `09:30` or `18:00`. For something without a time use `"when": { "en": "Night", "ko": "밤" }` instead.
- `type`: `normal`, `taxi`, `drive`, `reserve` (shows the red **Reserved** badge), `fixed` (highlighted fixed event) or `optional`.
- `note` is optional. You can delete the whole `note` line.
- `place`: optional link to a card on the Places page, for example `"place": "klementinum"`. Use an `id` from `places.json`.
- `mapQuery`: optional text for the map button, for example a restaurant name and street.

To add an item, copy an existing one, paste it in the right place, and edit it. Keep a comma between items.

### `places.json` (sightseeing cards)
Each card has `name`, `desc` (short description), `hours`, `accessNote`, `tickets` and `address`. These have English and Korean versions. `access` is `easy`, `moderate` or `hard` and sets the colored label for older adults. `mapQuery` is what the map app searches for. `link` is the official website. `image` holds the photo file (in the `images/places` folder), a `credit` line and the Commons `source` page; the credit is shown under the photo as the licenses require. To change a photo, put a new file in `images/places` and update `file`, `credit` and `source`. Set `"verified": true` once you have checked the hours and prices on the official site; until then the card shows a "Not verified" label.

### `contacts.json` (addresses and phone numbers)
- `airbnb`: address, host name, host phone. The address also appears in large Czech text on the "Show this to a taxi driver" card.
- `family`: the group-chat link and each person's phone and KakaoTalk link. Phone numbers become tap-to-call buttons and KakaoTalk links become yellow buttons.
- `embassy`: fill in the TODO lines. Phone numbers with `+420 ...` or `+49 ...` become tap-to-call buttons.
- `emergency`: 112 is the EU emergency number. 155 is ambulance and 158 is police in Czechia.

### `info.json` (tips and the koruna helper)
- `tips`: each tip has a `title` and `body` in both languages. Add or remove tips by copying a block.
- `currency.rates`: how many Czech koruna one USD, one EUR and one Korean won are worth. Update these just before the trip and set `updated` to the date, like `"2026-11-20"`.

### `stays.json` (hotels and apartments)
One block per place we sleep: name, address, dates (`from` is check-in, `to` is check-out), `phone` and `kakao`. `kakao` is a link that starts with `https://` (for example a KakaoTalk open-chat link). `lang` is `cs` or `de` and picks the language of the large taxi card. Each day in `itinerary.json` lists the `stay` ids it uses.

### `flights.json` (the Flights tab)
`travelers` is the list of people shown at the top: a short `id` (like `JS`) plus the display `name` in English and Korean. `who` in each trip uses the `id`. Each trip has `date`, `number`, `from`, `to`, `dep`, `arr` (24-hour, local time), `who` (traveler names) and `kind` (`flight` or `train`). Add `"nextDay": true` when the flight lands the next day. Leave `arr` out if unknown.

### `site.json`
The trip title, the dates, and the `cities` that draw the route map (name, latitude, longitude).

## If something goes wrong
On GitHub, open the file, click **History**, pick an earlier version, and copy it back. Nothing you change here can break the old copy that people already have on their phones.
