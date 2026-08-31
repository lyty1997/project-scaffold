local function is_portable_link(target)
  local lower = string.lower(target)
  return string.sub(target, 1, 1) == "#"
    or string.match(lower, "^https?://") ~= nil
    or string.match(lower, "^mailto:") ~= nil
    or string.match(lower, "^tel:") ~= nil
end

function Link(link)
  if is_portable_link(link.target) then
    return link
  end

  local attributes = {
    { "data-original-href", link.target },
    { "title", "Repository-local link (not navigable in the portable copy): " .. link.target },
  }
  return pandoc.Span(
    link.content,
    pandoc.Attr("", { "portable-local-link" }, attributes)
  )
end
