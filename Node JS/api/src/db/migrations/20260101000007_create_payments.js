exports.up = function (knex) {
  return knex.schema.createTable('payments', (table) => {
    table.increments('id').primary();
    table.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.string('processor_transaction_id');
    table.string('processor_card_token');
    table.integer('amount_cents').notNullable();
    table.enu('status', ['authorized', 'captured', 'failed', 'refunded', 'partially_refunded']).notNullable();
    table.string('card_last4');
    table.string('card_brand');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  }).alterTable('orders', (table) => {
    table.integer('payment_id').unsigned().references('id').inTable('payments');
  });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('orders', (table) => {
      table.dropColumn('payment_id');
    })
    .dropTableIfExists('payments');
};
