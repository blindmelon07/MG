import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import ManualController from '@/actions/App/Http/Controllers/Admin/ManualController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { create, index as manualsIndex } from '@/routes/admin/manuals';

export default function ManualsCreate({
    categories,
}: {
    categories: { id: number; name: string }[];
}) {
    const [previews, setPreviews] = useState<string[]>([]);

    return (
        <>
            <Head title="New Manual" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="New Manual"
                    description="Add a new entry to the digital school manual."
                />

                <Form
                    {...ManualController.store.form()}
                    className="max-w-2xl space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" name="title" required />
                                <InputError message={errors.title} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="manual_category_id">
                                    Category
                                </Label>
                                <Select
                                    name="manual_category_id"
                                    required
                                    defaultValue={
                                        categories[0]
                                            ? String(categories[0].id)
                                            : undefined
                                    }
                                >
                                    <SelectTrigger
                                        id="manual_category_id"
                                        className="w-full"
                                    >
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((category) => (
                                            <SelectItem
                                                key={category.id}
                                                value={String(category.id)}
                                            >
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError
                                    message={errors.manual_category_id}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="content">Content</Label>
                                <Textarea
                                    id="content"
                                    name="content"
                                    required
                                    className="min-h-64"
                                />
                                <InputError message={errors.content} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select name="status" defaultValue="draft">
                                    <SelectTrigger
                                        id="status"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">
                                            Draft
                                        </SelectItem>
                                        <SelectItem value="published">
                                            Published
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.status} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="images">
                                    Images (optional)
                                </Label>
                                <Input
                                    id="images"
                                    name="images[]"
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    multiple
                                    onChange={(event) =>
                                        setPreviews((current) => {
                                            current.forEach((url) =>
                                                URL.revokeObjectURL(url),
                                            );

                                            return Array.from(
                                                event.target.files ?? [],
                                            ).map((file) =>
                                                URL.createObjectURL(file),
                                            );
                                        })
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Up to 10 images, 20 MB each. You can add
                                    more or remove them later when editing.
                                </p>
                                {previews.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                        {previews.map((url) => (
                                            <img
                                                key={url}
                                                src={url}
                                                alt=""
                                                className="aspect-square w-full rounded-md border object-cover"
                                            />
                                        ))}
                                    </div>
                                )}
                                <InputError
                                    message={
                                        errors.images ??
                                        Object.entries(errors).find(([key]) =>
                                            key.startsWith('images.'),
                                        )?.[1]
                                    }
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button type="submit" disabled={processing}>
                                    Create Manual
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

ManualsCreate.layout = {
    breadcrumbs: [
        { title: 'Manuals', href: manualsIndex() },
        { title: 'New', href: create() },
    ],
};
