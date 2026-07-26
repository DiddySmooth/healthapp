import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Input } from "../components/ui";
import { useFoodMutations, useFoods, type Food } from "../lib/foods";

function FoodRow({ food }: { food: Food }) {
  const { remove } = useFoodMutations();
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {food.name}
          {food.brand && <span className="ml-1 text-xs text-faint">({food.brand})</span>}
        </p>
        <p className="text-xs text-muted">
          {food.servingSize} {food.servingUnit} · {Math.round(food.calories)} cal · P
          {food.protein} C{food.carbs} F{food.fat}
        </p>
      </div>
      <Link to={`/food/foods/${food.id}/edit`}>
        <Button variant="ghost" className="px-3 py-1">
          Edit
        </Button>
      </Link>
      <Button
        variant="danger"
        className="px-3 py-1"
        onClick={() => {
          if (window.confirm(`Delete "${food.name}"? Logged history keeps its numbers.`))
            remove.mutate(food.id);
        }}
      >
        Delete
      </Button>
    </li>
  );
}

export default function FoodLibrary() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useFoods(search.trim());

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Foods</h1>
        <Link to="/food/foods/new">
          <Button>New food</Button>
        </Link>
      </div>
      <Input
        placeholder="Search foods…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />
      {isLoading ? (
        <p className="py-12 text-center text-muted">Loading…</p>
      ) : (data?.foods.length ?? 0) === 0 ? (
        <Card>
          <p className="text-center text-muted">
            {search ? "No foods match." : "No foods yet — add the things you eat once, log them forever."}
          </p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {data?.foods.map((f) => <FoodRow key={f.id} food={f} />)}
          </ul>
        </Card>
      )}
    </div>
  );
}
