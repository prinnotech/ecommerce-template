/// <reference path="../pb_data/types.d.ts" />

// Assigns sequential human-readable order numbers (#1001, #1002, …).
// The unique index on order_number rejects a duplicate if two orders race.
onRecordCreate((e) => {
  if (!e.record.getInt("order_number")) {
    const FIRST_ORDER_NUMBER = 1001;
    let next_number = FIRST_ORDER_NUMBER;
    try {
      const last = e.app.findRecordsByFilter("orders", "order_number > 0", "-order_number", 1, 0);
      if (last.length > 0) next_number = last[0].getInt("order_number") + 1;
    } catch (err) {
      // No orders yet: keep the first number.
    }
    e.record.set("order_number", next_number);
  }
  e.next();
}, "orders");
