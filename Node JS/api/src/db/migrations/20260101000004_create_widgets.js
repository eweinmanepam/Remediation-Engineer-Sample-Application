exports.up = function (knex) {
  return knex.schema.createTable('widgets', (table) => {
    table.increments('id').primary();
    table.string('sku').notNullable().unique();
    table.string('name').notNullable();
    table.text('description');
    table.integer('price_cents').notNullable();
    table.string('currency').notNullable().defaultTo('USD');
    table.integer('stock_quantity').notNullable().defaultTo(0);
    table.integer('category_id').unsigned().references('id').inTable('categories').onDelete('SET NULL');
    table.string('image_url');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.integer('updated_by').unsigned().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('widgets');
};
