exports.up = function (knex) {
  return knex.schema
    .createTable('carts', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('cart_items', (table) => {
      table.increments('id').primary();
      table.integer('cart_id').unsigned().notNullable().references('id').inTable('carts').onDelete('CASCADE');
      table.integer('widget_id').unsigned().notNullable().references('id').inTable('widgets');
      table.integer('quantity').notNullable();
      table.unique(['cart_id', 'widget_id']);
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('cart_items').dropTableIfExists('carts');
};
