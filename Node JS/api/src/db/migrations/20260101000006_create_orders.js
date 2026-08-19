exports.up = function (knex) {
  return knex.schema
    .createTable('orders', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
      table
        .enu('status', [
          'pending_payment',
          'paid',
          'refunded',
          'partially_refunded',
          'exchange_pending',
          'exchanged',
          'cancelled',
        ])
        .notNullable()
        .defaultTo('pending_payment');
      table.integer('subtotal_cents').notNullable();
      table.integer('total_cents').notNullable();
      table.integer('shipping_address_id').unsigned().references('id').inTable('addresses');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('order_items', (table) => {
      table.increments('id').primary();
      table.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
      table.integer('widget_id').unsigned().notNullable().references('id').inTable('widgets');
      table.integer('quantity').notNullable();
      table.integer('unit_price_cents').notNullable();
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('order_items').dropTableIfExists('orders');
};
