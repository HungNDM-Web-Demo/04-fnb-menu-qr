using Domain.Entities.Pos.Menu;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

// Thực đơn: Pos_Categories, Pos_MenuItems, Pos_OptionGroups, Pos_OptionChoices, Pos_MenuItemOptionGroups (06 §4).

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Pos_Categories");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(Category.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Category.NameMaxLength).IsRequired();
        builder.Property(x => x.NameEn).HasMaxLength(Category.NameMaxLength);
        builder.Property(x => x.Color).HasMaxLength(Category.ColorMaxLength).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
    }
}

public sealed class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("Pos_MenuItems");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Code).HasMaxLength(MenuItem.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(MenuItem.NameMaxLength).IsRequired();
        builder.Property(x => x.NameEn).HasMaxLength(MenuItem.NameMaxLength);
        builder.Property(x => x.ImageUrl).HasMaxLength(MenuItem.ImageUrlMaxLength);
        builder.Property(x => x.Description).HasMaxLength(MenuItem.DescriptionMaxLength);
        builder.Property(x => x.DescriptionEn).HasMaxLength(MenuItem.DescriptionMaxLength);
        builder.Property(x => x.Unit).HasMaxLength(MenuItem.UnitMaxLength).IsRequired();
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.Property(x => x.Tags).HasMaxLength(MenuItem.TagsMaxLength).IsRequired();

        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
        builder.HasIndex(x => new { x.CategoryId, x.SortOrder });

        builder.HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.OptionGroups)
            .WithOne()
            .HasForeignKey(x => x.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class MenuItemOptionGroupConfiguration : IEntityTypeConfiguration<MenuItemOptionGroup>
{
    public void Configure(EntityTypeBuilder<MenuItemOptionGroup> builder)
    {
        builder.ToTable("Pos_MenuItemOptionGroups");
        builder.HasKey(x => new { x.MenuItemId, x.OptionGroupId });
        builder.HasIndex(x => x.OptionGroupId);

        builder.HasOne(x => x.OptionGroup)
            .WithMany()
            .HasForeignKey(x => x.OptionGroupId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OptionGroupConfiguration : IEntityTypeConfiguration<OptionGroup>
{
    public void Configure(EntityTypeBuilder<OptionGroup> builder)
    {
        builder.ToTable("Pos_OptionGroups");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).HasMaxLength(OptionGroup.NameMaxLength).IsRequired();
        builder.Property(x => x.NameEn).HasMaxLength(OptionGroup.NameMaxLength);
        builder.Ignore(x => x.ActiveChoices);

        builder.HasMany(x => x.Choices)
            .WithOne()
            .HasForeignKey(x => x.OptionGroupId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OptionChoiceConfiguration : IEntityTypeConfiguration<OptionChoice>
{
    public void Configure(EntityTypeBuilder<OptionChoice> builder)
    {
        builder.ToTable("Pos_OptionChoices");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).HasMaxLength(OptionChoice.NameMaxLength).IsRequired();
        builder.Property(x => x.NameEn).HasMaxLength(OptionChoice.NameMaxLength);
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.OptionGroupId, x.SortOrder });
    }
}
