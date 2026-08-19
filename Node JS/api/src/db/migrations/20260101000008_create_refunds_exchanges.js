exports.up = function (knex) {
  return knex.schema
    .createTable('refunds', (table) => {
      table.increments('id').primary();
      table.integer('order_id').unsigned().notNullable().references('id').inTable('orders');
      table.integer('payment_id').unsigned().notNullable().references('id').inTable('payments');
      table.integer('issued_by').unsigned().notNullable().references('id').inTable('users');
      table.integer('amount_cents').notNullable();
      table.text('reason');
      table.string('processor_refund_id');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('exchanges', (table) => {
      table.increments('id').primary();
      table.integer('order_id').unsigned().notNullable().references('id').inTable('orders');
      table.integer('processed_by').unsigned().references('id').inTable('users');
      table.integer('returned_widget_id').unsigned().references('id').inTable('widgets');
      table.integer('returned_quantity');
      table.integer('replacement_widget_id').unsigned().references('id').inTable('widgets');
      table.integer('replacement_quantity');
      table.enu('status', ['requested', 'received', 'completed', 'rejected']).notNullable().defaultTo('requested');
      table.text('notes');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('exchanges').dropTableIfExists('refunds');
};
